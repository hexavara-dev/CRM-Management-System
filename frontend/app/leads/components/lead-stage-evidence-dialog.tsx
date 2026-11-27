"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import type { Lead } from "@/types/lead";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DealDocumentsTable } from "@/app/deals/components/deal-documents";
import { isEvidenceGrandfathered } from "@/lib/evidence-grandfathering";

function fulfilledEvidenceNames(lead: Lead, stageId: string) {
  return new Set((lead.attachments ?? []).flatMap((attachment) =>
    attachment.documentStageId === stageId && attachment.documentName ? [attachment.documentName] : [],
  ));
}

export function isLeadEvidenceGrandfathered(
  lead: Lead,
  target: Pick<PipelineStage, "id" | "position">,
  stages: PipelineStage[],
) {
  return isEvidenceGrandfathered(lead.evidenceGrandfatheredStageIds, target, stages);
}

export function LeadStageEvidenceDialog({ lead, stage, stages, open, saving, onCancel, onSave }: {
  lead: Lead;
  stage: PipelineStage;
  stages: PipelineStage[];
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (documents: { name: string; file: File }[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [showMissing, setShowMissing] = useState(false);
  // Evidence Lead sepenuhnya berasal dari konfigurasi fase. Baris tambahan
  // hanya berlaku saat membuat Deal, sehingga tidak boleh muncul di sini.
  const documents = useMemo(() => stage.evidences, [stage.evidences]);
  const isGrandfathered = isLeadEvidenceGrandfathered(lead, stage, stages);
  const fulfilled = useMemo(() => isGrandfathered
    ? new Set(documents.map((document) => document.name))
    : fulfilledEvidenceNames(lead, stage.id), [documents, isGrandfathered, lead, stage.id]);
  const missing = documents.filter((document) => document.isRequired && !fulfilled.has(document.name) && !files[document.name]);

  const save = async () => {
    if (missing.length) {
      setShowMissing(true);
      return;
    }
    await onSave(Object.entries(files).map(([name, file]) => ({ name, file })));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Evidence Fase {stage.name}</DialogTitle>
          <DialogDescription>
            {isGrandfathered
              ? "Lead ini sudah pernah mencapai fase ini sebelum evidence terbaru diberlakukan. Tidak perlu mengunggah ulang."
              : "Lengkapi persyaratan sebelum Lead dipindahkan. Evidence wajib yang pernah dipenuhi tidak perlu diunggah ulang."}
          </DialogDescription>
        </DialogHeader>
        <DealDocumentsTable documents={documents} files={files} fulfilledNames={fulfilled} showMissing={showMissing} stageName={stage.name} entityLabel="Lead" onChange={(name, file) => setFiles((current) => {
          const next = { ...current };
          if (file) next[name] = file;
          else delete next[name];
          return next;
        })} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Batal</Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? <><Loader2 className="size-4 animate-spin" /> Menyimpan...</> : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
