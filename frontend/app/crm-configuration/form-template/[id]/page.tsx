"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppSidebar } from "@/components/Sidebar";
import { ConfigNavbar } from "../../config-header";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormTemplate } from "@/hooks/use-form-templates";
import { errorMessage } from "@/hooks/use-projects";
import { TemplateEditor } from "../template-editor";

export default function EditFormTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const template = useFormTemplate(id);

  if (template.data) {
    // `key` memastikan form diisi ulang bila data template berganti.
    return <TemplateEditor key={`${template.data.id}-${template.data.version}`} template={template.data} canWrite={user?.role === "owner"} />;
  }

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <ConfigNavbar />
        <div className="space-y-4 p-4">
          {template.isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-[#D64545]/40 py-12 text-center">
              <p className="text-sm text-[#D64545]">{errorMessage(template.error, "Template tidak ditemukan.")}</p>
              <Button asChild variant="outline">
                <Link href="/crm-configuration/form-template">Kembali ke daftar template</Link>
              </Button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
