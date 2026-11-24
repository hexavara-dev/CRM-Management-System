import { z } from "zod";

export const viewingFormSchema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  actorId: z.string().optional(),
  statusId: z.string().optional(),
  sourceId: z.string().optional(),
  locationId: z.string().optional(),
  scheduledAt: z.string().min(1, "Visit date is required"),
  durationMinutes: z
    .string()
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= 15 && Number(value) <= 480,
      "Duration must be between 15 and 480 minutes",
    ),
  notes: z.string().optional(),
});

export type ViewingFormData = z.infer<typeof viewingFormSchema>;
