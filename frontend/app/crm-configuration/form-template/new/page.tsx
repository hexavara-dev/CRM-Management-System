"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { TemplateEditor } from "../template-editor";

export default function NewFormTemplatePage() {
  const { user } = useAuth();
  return <TemplateEditor canWrite={user?.role === "owner"} />;
}
