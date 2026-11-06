import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  tenantName: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(150, "Organization name is too long"),
  name: z.string().trim().max(150, "Name is too long").optional(),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
