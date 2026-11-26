"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormTemplate } from "@/hooks/use-form-templates";
import { errorMessage } from "@/hooks/use-projects";
import { LabelIcon } from "../leads-label/label-icons";
import { ADD_LEAD_DIALOG_WIDTH, FormPreview } from "./form-preview";
import { cn } from "@/lib/utils";

/** Pratinjau form sebuah template seperti yang dilihat sales saat menambah Lead. */
export function PreviewDialog({ id, onOpenChange }: { id?: string; onOpenChange: (open: boolean) => void }) {
  const template = useFormTemplate(id);
  const data = template.data;
  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] gap-5 overflow-y-auto p-4 sm:p-6", ADD_LEAD_DIALOG_WIDTH)}>
        <DialogHeader className="flex-row items-center gap-3 text-left">
          {data && <LabelIcon icon={data.icon} color={data.color} />}
          <div>
            <DialogTitle>{data?.name ?? "Preview Template"}</DialogTitle>
            <DialogDescription>
              {data ? `Preview form Add Lead · Versi ${data.version}` : "Memuat template"}
            </DialogDescription>
          </div>
        </DialogHeader>
        {template.isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : template.isError || !data ? (
          <p className="text-sm text-[#D64545]">{errorMessage(template.error, "Gagal memuat template.")}</p>
        ) : (
          <FormPreview fields={data.fields} />
        )}
      </DialogContent>
    </Dialog>
  );
}
