import { z } from "zod";

export const dealFormSchema = z.object({
  leadId: z.string().optional(),
  dealType: z.string().optional(),
  expectedAmount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  amount: z.coerce.number().min(0, "Amount must be 0 or greater").optional(),
  currency: z.string(),
  expectedClosingDate: z.string().optional(),
  stageId: z.string().optional(),
  statusId: z.string().optional(),
  assignedUserId: z.string().optional(),
  lostReason: z.string().optional(),
  lostNotes: z.string().optional(),
  unitId: z.string().optional(),
  paymentMethod: z.enum(["CASH", "KPR", "KPR_SHARIA"]).optional(),
  bankName: z.string().max(150).optional(),
  notes: z.string().max(10000).optional(),
  financingBankId: z.string().optional(),
});

export type DealFormData = z.infer<typeof dealFormSchema>;

export const callLogFormSchema = z.object({
  notes: z.string().min(1, "Call notes are required"),
  duration: z.coerce.number().min(0).optional(),
});

export type CallLogFormData = z.infer<typeof callLogFormSchema>;

export const taskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  assignedUserId: z.string().optional(),
});

export type TaskFormData = z.infer<typeof taskFormSchema>;

export const noteFormSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

export type NoteFormData = z.infer<typeof noteFormSchema>;

export const convertLeadSchema = z.object({
  expectedAmount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  currency: z.string(),
});

export type ConvertLeadData = z.infer<typeof convertLeadSchema>;
