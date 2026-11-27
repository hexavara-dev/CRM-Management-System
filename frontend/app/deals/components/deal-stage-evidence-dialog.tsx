"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PipelineStage, StageEvidence } from "@/hooks/use-pipeline-stages";
import { isEvidenceGrandfathered } from "@/lib/evidence-grandfathering";
import type { Deal } from "@/types/deal";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DealDocumentsTable } from "./deal-documents";

const paymentLabels = {
  CASH: "Tunai",
  KPR: "KPR",
  KPR_SHARIA: "KPR Syariah",
} as const;

export function applicableDealEvidences(
  stage: PipelineStage,
  deal: Deal,
): StageEvidence[] {
  return stage.evidences.filter(
    ({ paymentMethods }) =>
      !paymentMethods || paymentMethods.includes(deal.paymentMethod),
  );
}

export function isDealEvidenceGrandfathered(
  deal: Deal,
  target: Pick<PipelineStage, "id" | "position">,
  stages: PipelineStage[],
) {
  return isEvidenceGrandfathered(deal.evidenceGrandfatheredStageIds, target, stages);
}

export function fulfilledEvidenceNames(deal: Deal, stageId: string) {
  return new Set(
    (deal.attachments ?? []).flatMap((attachment) =>
      attachment.documentStageId === stageId && attachment.documentName
        ? [attachment.documentName]
        : [],
    ),
  );
}

export function DealStageEvidenceDialog({
  deal,
  stage,
  stages,
  open,
  saving,
  onCancel,
  onSave,
}: {
  deal: Deal;
  stage: PipelineStage;
  stages: PipelineStage[];
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (documents: { name: string; file: File }[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [showMissing, setShowMissing] = useState(false);
  const evidences = useMemo(
    () => applicableDealEvidences(stage, deal),
    [deal, stage],
  );
  const isGrandfathered = isDealEvidenceGrandfathered(deal, stage, stages);
  const fulfilled = useMemo(
    () => isGrandfathered
      ? new Set(evidences.map((evidence) => evidence.name))
      : fulfilledEvidenceNames(deal, stage.id),
    [deal, evidences, isGrandfathered, stage.id],
  );
  const missing = evidences.filter(
    (evidence) =>
      evidence.isRequired &&
      !fulfilled.has(evidence.name) &&
      !files[evidence.name],
  );

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
              ? "Deal ini sudah pernah mencapai fase ini sebelum evidence terbaru diberlakukan. Tidak perlu mengunggah ulang."
              : "Lengkapi persyaratan sebelum Deal dipindahkan. Evidence wajib yang pernah dipenuhi tidak perlu diunggah ulang."}
          </DialogDescription>
        </DialogHeader>
        <DealDocumentsTable
          documents={evidences}
          files={files}
          fulfilledNames={fulfilled}
          showMissing={showMissing}
          stageName={stage.name}
          paymentLabel={paymentLabels[deal.paymentMethod]}
          onChange={(name, file) =>
            setFiles((current) => {
              const next = { ...current };
              if (file) next[name] = file;
              else delete next[name];
              return next;
            })
          }
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onCancel}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
