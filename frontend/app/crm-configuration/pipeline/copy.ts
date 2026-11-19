import type { PipelineEntity } from "@/hooks/use-pipeline-stages";

/** Teks yang berbeda antara Konfigurasi Leads Pipeline dan Deals Pipeline. */
export interface PipelineCopy {
  /** "Lead" atau "Deal". */
  item: string;
  /** "Leads" atau "Deals". */
  items: string;
  pageDescription: string;
  probabilityHint: string;
  defaultHint: string;
  terminalHint: string;
}

export const PIPELINE_COPY: Record<PipelineEntity, PipelineCopy> = {
  lead: {
    item: "Lead",
    items: "Leads",
    pageDescription: "Atur tahapan (pipeline) proses Lead mulai dari prospek awal hingga menjadi Deal.",
    probabilityHint: "Peluang Lead di tahapan ini menjadi Deal.",
    defaultHint: "Lead baru otomatis masuk ke tahapan ini.",
    terminalHint: "Tahapan terakhir proses Lead, mis. Converted to Deal.",
  },
  deal: {
    item: "Deal",
    items: "Deals",
    pageDescription: "Atur tahapan (pipeline) proses Deal mulai dari tanda jadi hingga serah terima.",
    probabilityHint: "Peluang Deal di tahapan ini berhasil (won).",
    defaultHint: "Deal baru otomatis masuk ke tahapan ini.",
    terminalHint: "Tahapan terakhir proses Deal, mis. Serah Terima.",
  },
};
