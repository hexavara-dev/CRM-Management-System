import { z } from "zod";

const requiredPhoneSchema = z.string().trim().min(7, "Nomor handphone minimal 7 digit").max(30).regex(/^\+?[0-9\s().-]+$/, "Format nomor handphone tidak valid");

export const leadFormSchema = z.object({
  firstName: z.string().trim().min(1, "Nama lengkap wajib diisi").max(100),
  lastName: z.string().optional(),
  email: z.string().trim().email("Format email tidak valid").max(255).optional().or(z.literal("")),
  phone: requiredPhoneSchema.optional().or(z.literal("")),
  age: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : Number(value),
    z.number().int("Umur harus berupa bilangan bulat").min(0, "Umur tidak boleh negatif").max(120, "Umur maksimal 120 tahun").optional(),
  ),
  company: z.string().optional(),
  statusId: z.string(),
  source: z.string().optional(),
  notes: z.string().optional(),
  assignedUserId: z.string().optional(),
  gender: z.string().optional(),
  salutation: z.string().optional(),
  organizationName: z.string().optional(),
  organizationLocation: z.string().optional(),
  location: z.string().optional(),
  locationId: z.string().optional(),
  projectId: z.string().optional(),
  productVariantId: z.string().optional(),
  campaignId: z.string().optional(),
  budget: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : Number(value),
    z.number().finite().min(0, "Budget tidak boleh negatif").max(9_999_999_999_999.99, "Budget terlalu besar").optional(),
  ),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  createDeal: z.boolean().optional(),
  sourceUserId: z.string().optional(),
  sourceId: z.string().optional(),
  labelIds: z.array(z.string()).max(20),
});

export const leadCreateFormSchema = leadFormSchema.extend({
  phone: requiredPhoneSchema,
  statusId: z.string().min(1, "Status Lead wajib dipilih"),
  sourceId: z.string().min(1, "Sumber Lead wajib dipilih"),
  assignedUserId: z.string().min(1, "Assigned Sales wajib dipilih"),
});

export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormData = z.infer<typeof leadFormSchema>;
export type LeadCreateFormInput = z.input<typeof leadCreateFormSchema>;
export type LeadCreateFormData = z.output<typeof leadCreateFormSchema>;
