import type { DealPaymentMethod } from '@prisma/client';

/** Baris bawaan form Tambah Deal; opsional dan tidak perlu dikonfigurasi. */
export const EXTRA_DOCUMENT = 'Dokumen Tambahan';
export const MAX_DEAL_DOCUMENTS = 21;

export type DealDocumentInput = { name: string; fileIndex: number };
export type DocumentRequirement = {
  name: string;
  fileTypes: unknown;
  isRequired: boolean;
  paymentMethods: unknown;
};

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];
/** Kelompok tipe evidence, ekstensi, dan awal berkas. Ekstensi tidak pernah diambil dari nama berkas klien. */
const FILE_KINDS: Record<string, { type: string; ext: string; signature: number[] }> = {
  'application/pdf': { type: 'PDF', ext: 'pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  'image/jpeg': { type: 'IMAGE', ext: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { type: 'IMAGE', ext: 'png', signature: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { type: 'IMAGE', ext: 'webp', signature: [0x52, 0x49, 0x46, 0x46] },
  'application/msword': { type: 'DOC', ext: 'doc', signature: OLE },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'DOC', ext: 'docx', signature: ZIP },
  'application/vnd.ms-excel': { type: 'SHEET', ext: 'xls', signature: OLE },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { type: 'SHEET', ext: 'xlsx', signature: ZIP },
};

export type CheckedDocument = { name: string; file: Express.Multer.File; ext: string };

/** Mencocokkan berkas dengan persyaratan tahapan pertama untuk jenis pembayaran yang dipilih. */
export function checkDealDocuments(
  requirements: DocumentRequirement[],
  paymentMethod: DealPaymentMethod,
  documents: DealDocumentInput[],
  files: Express.Multer.File[]
): CheckedDocument[] {
  const applicable = requirements.filter(
    ({ paymentMethods }) => !Array.isArray(paymentMethods) || paymentMethods.includes(paymentMethod)
  );
  const names = new Set(documents.map((item) => item.name));
  const indexes = new Set(documents.map((item) => item.fileIndex));
  if (names.size !== documents.length || indexes.size !== documents.length || documents.length !== files.length) {
    throw new Error('Invalid deal documents');
  }

  const checked = documents.map(({ name, fileIndex }) => {
    const requirement = applicable.find((item) => item.name === name);
    if (!requirement && name !== EXTRA_DOCUMENT) throw new Error(`Invalid deal document "${name}"`);
    const file = files[fileIndex];
    if (!file) throw new Error('Invalid deal documents');
    const kind = FILE_KINDS[file.mimetype];
    if (!kind || !kind.signature.every((byte, index) => file.buffer[index] === byte)) {
      throw new Error(`Unsupported file type: ${name}`);
    }
    if (requirement && !(Array.isArray(requirement.fileTypes) && requirement.fileTypes.includes(kind.type))) {
      throw new Error(`Unsupported file type: ${name}`);
    }
    return { name, file, ext: kind.ext };
  });

  const missing = applicable.filter((item) => item.isRequired && !names.has(item.name)).map((item) => item.name);
  if (missing.length) throw new Error(`Required documents are missing: ${missing.join(', ')}`);
  return checked;
}
