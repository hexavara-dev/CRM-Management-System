import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  role: z.enum(["owner", "member"]),
});

export type InviteFormData = z.infer<typeof inviteSchema>;
