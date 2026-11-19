"use client";

import type { PipelineEntity, PipelineStage } from "@/hooks/use-pipeline-stages";
import { DealPreviewDialog } from "./deal-preview";
import { LeadPreviewDialog } from "./lead-preview";

/** Pratinjau kanban sesuai jenis pipeline. */
export function PreviewDialog({
  entity,
  ...props
}: {
  entity: PipelineEntity;
  open: boolean;
  stages: PipelineStage[];
  onOpenChange: (open: boolean) => void;
}) {
  return entity === "deal" ? <DealPreviewDialog {...props} /> : <LeadPreviewDialog {...props} />;
}
