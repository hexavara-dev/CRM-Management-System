import { z } from "zod";

export const convertDealSchema = z
  .object({
    expectedAmount: z
      .number()
      .min(0, "Amount must be a positive number")
      .optional()
      .or(z.number().min(0, "Amount must be a positive number")),
    unitId: z.string().min(1, "Unit wajib dipilih"),
    paymentMethod: z.enum(["CASH", "KPR", "KPR_SHARIA"]),
    financingBankId: z.string().optional(),
    notes: z.string().max(10000).optional(),
  })
  .superRefine((data, context) => {
    if (data.paymentMethod !== "CASH" && !data.financingBankId) {
      context.addIssue({
        code: "custom",
        path: ["financingBankId"],
        message: "Bank pembiayaan wajib dipilih",
      });
    }
  });

export type ConvertDealFormData = z.infer<typeof convertDealSchema>;
