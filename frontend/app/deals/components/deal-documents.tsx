"use client";

import { CircleCheck, CircleMinus, CircleX, Eye, FileText, Info, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EvidenceFileType, StageEvidence } from "@/hooks/use-pipeline-stages";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
/** Sama dengan EXTRA_DOCUMENT di backend. */
const EXTRA_DOCUMENT = "Dokumen Tambahan";

const MIME: Record<EvidenceFileType, string[]> = {
  PDF: ["application/pdf"],
  DOC: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
  SHEET: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export type DealDocument = Pick<StageEvidence, "name" | "fileTypes" | "isRequired" | "description">;

/** Dokumen tahapan pertama untuk jenis pembayaran terpilih, ditambah baris bawaan. */
export function dealDocuments(evidences: StageEvidence[], paymentMethod: string): DealDocument[] {
  const rows: DealDocument[] = evidences.filter(
    ({ paymentMethods }) => !paymentMethods || (paymentMethods as string[]).includes(paymentMethod),
  );
  if (rows.some((row) => row.name === EXTRA_DOCUMENT)) return rows;
  return [
    ...rows,
    {
      name: EXTRA_DOCUMENT,
      fileTypes: ["PDF", "DOC", "IMAGE", "SHEET"],
      isRequired: false,
      description: "Dokumen pendukung lainnya (jika ada).",
    },
  ];
}

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function preview(file: File) {
  const url = URL.createObjectURL(file);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function UploadButton({ document, onSelect }: { document: DealDocument; onSelect: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = document.fileTypes.flatMap((type) => MIME[type]);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={`Berkas ${document.name}`}
        accept={accepted.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!accepted.includes(file.type)) toast.error(`Tipe berkas ${document.name} tidak sesuai.`);
          else if (file.size > MAX_BYTES) toast.error("Ukuran berkas maksimal 10 MB.");
          else onSelect(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-[#1980C0] text-[#1980C0] hover:text-[#1980C0]"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        Upload Dokumen
      </Button>
    </>
  );
}

export function DealDocumentsTable({
  documents,
  files,
  showMissing,
  onChange,
}: {
  documents: DealDocument[];
  files: Record<string, File>;
  /** Tandai dokumen wajib yang belum ada (setelah mencoba simpan). */
  showMissing: boolean;
  onChange: (name: string, file: File | undefined) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[#F8FAFC] text-left">
            <tr>
              <th className="w-12 px-3 py-2.5 font-medium">No</th>
              <th className="px-3 py-2.5 font-medium">Nama Dokumen</th>
              <th className="px-3 py-2.5 font-medium">Keterangan</th>
              <th className="w-40 px-3 py-2.5 font-medium">Status</th>
              <th className="w-72 px-3 py-2.5 font-medium">File</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document, index) => {
              const file = files[document.name];
              const missing = !file && document.isRequired;
              return (
                <tr key={document.name} className={cn("border-t border-[#EDEDED]", missing && showMissing && "bg-[#FDECEC]")}>
                  <td className="px-3 py-2.5">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#1f1f1f]">{document.name}</span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          document.isRequired ? "bg-[#FDECEC] text-[#D64545]" : "bg-[#EEF0F4] text-[#475467]",
                        )}
                      >
                        {document.isRequired ? "Wajib" : "Opsional"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[#475467]">{document.description ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        file ? "text-[#1E9E55]" : missing ? "text-[#D64545]" : "text-[#6b6b6b]",
                      )}
                    >
                      {file ? <CircleCheck className="size-4" /> : missing ? <CircleX className="size-4" /> : <CircleMinus className="size-4" />}
                      {file ? "Siap diunggah" : missing ? "Belum ada" : "Opsional"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {file ? (
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-[#1980C0]" />
                        <span className="min-w-0 flex-1 break-all">
                          {file.name} <span className="whitespace-nowrap text-[#6b6b6b]">({sizeLabel(file.size)})</span>
                        </span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Lihat ${document.name}`} onClick={() => preview(file)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Hapus ${document.name}`}
                          className="text-[#D64545] hover:text-[#D64545]"
                          onClick={() => onChange(document.name, undefined)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <UploadButton document={document} onSelect={(selected) => onChange(document.name, selected)} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-[#F6FAFD] p-3 text-sm text-[#475467]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#1980C0]" />
        Daftar dokumen mengikuti konfigurasi tahapan pertama Deals Pipeline dan jenis pembayaran. Dokumen wajib harus dilampirkan
        sebelum Deal dapat disimpan.
      </p>
    </>
  );
}
