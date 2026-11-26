import { z } from "zod";

export const viewingFormSchema = z.object({
  customerId: z.string().min(1, "Nama Customer wajib dipilih"),
  actorId: z.string().optional(),
  statusId: z.string().optional(),
  projectId: z.string().min(1, "Proyek wajib dipilih"),
  unitId: z.string().min(1, "Unit wajib dipilih"),
  visitDate: z.string().min(1, "Tanggal visit wajib diisi"),
  visitTime: z.string().min(1, "Jam visit wajib diisi"),
  durationMinutes: z.string().min(1, "Durasi wajib dipilih").refine(
    (value) =>
      /^\d+$/.test(value) && Number(value) >= 15 && Number(value) <= 480,
    "Durasi harus antara 15 sampai 480 menit",
  ),
  notes: z.string().optional(),
});

export type ViewingFormData = z.infer<typeof viewingFormSchema>;
