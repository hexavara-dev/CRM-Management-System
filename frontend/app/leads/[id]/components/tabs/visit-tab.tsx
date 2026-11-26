"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FormFileUpload } from "@/components/ui/form-file-upload";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useViewings } from "@/hooks/use-viewings";
import { formatDate } from "@/lib/helper";
import { Viewing } from "@/types/viewing";
import {
  CalendarCheck,
  CheckCircle2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

type EvidenceFormData = {
  file: FileList | null;
  notes: string;
};

type FailFormData = {
  reason: string;
};

function isViewingClosed(viewing: Viewing) {
  return Boolean(
    viewing.status?.isClosingStatus || viewing.status?.isFailedStatus,
  );
}

interface VisitTabProps {
  leadId: string;
}

export function VisitTab({ leadId }: VisitTabProps) {
  const { uploadEvidence, failViewing, isUploadingEvidence, isFailing } =
    useViewings();
  const isLoading = false;

  const [selectedViewing, setSelectedViewing] = useState<Viewing | null>(null);
  const [isEvidenceDialogOpen, setIsEvidenceDialogOpen] = useState(false);
  const [isFailDialogOpen, setIsFailDialogOpen] = useState(false);

  const evidenceForm = useForm<EvidenceFormData>({
    defaultValues: { file: null, notes: "" },
  });

  const failForm = useForm<FailFormData>({
    defaultValues: { reason: "" },
  });

  const leadViewings: Viewing[] = [];

  const openEvidenceDialog = (viewing: Viewing) => {
    setSelectedViewing(viewing);
    evidenceForm.reset({ file: null, notes: viewing.notes || "" });
    setIsEvidenceDialogOpen(true);
  };

  const openFailDialog = (viewing: Viewing) => {
    setSelectedViewing(viewing);
    failForm.reset({ reason: "" });
    setIsFailDialogOpen(true);
  };

  const handleSubmitEvidence = async (data: EvidenceFormData) => {
    if (!selectedViewing || !data.file || !data.file[0]) return;

    try {
      await uploadEvidence({
        id: selectedViewing.id,
        file: data.file[0],
        notes: data.notes || undefined,
      });
      setIsEvidenceDialogOpen(false);
      setSelectedViewing(null);
      evidenceForm.reset();
    } catch (error) {
      console.error("Failed to upload visit evidence:", error);
    }
  };

  const handleSubmitFail = async (data: FailFormData) => {
    if (!selectedViewing) return;

    try {
      await failViewing({
        id: selectedViewing.id,
        reason: data.reason || undefined,
      });
      setIsFailDialogOpen(false);
      setSelectedViewing(null);
      failForm.reset();
    } catch (error) {
      console.error("Failed to mark visit as failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Visit Schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Jadwal visit dikelola dari halaman Visit Schedule. Visit ditandai
            selesai setelah bukti diunggah.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
          Loading visits...
        </div>
      ) : leadViewings.length === 0 ? (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarCheck className="size-4" />
            </EmptyMedia>
            <EmptyTitle>Belum ada jadwal visit</EmptyTitle>
            <EmptyDescription>
              Tambah jadwal visit dari halaman Visit Schedule.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visit Date</TableHead>
                <TableHead>PIC Visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadViewings.map((viewing) => {
                const closed = isViewingClosed(viewing);
                const isClosing = viewing.status?.isClosingStatus;
                return (
                  <TableRow key={viewing.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="size-4 text-muted-foreground" />
                        {formatDate(new Date(viewing.scheduledAt))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {viewing.actor?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {viewing.status?.name ? (
                        <Badge colorHex={viewing.status?.color}>
                          {viewing.status?.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {viewing.source?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {viewing.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {closed ? (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            isClosing ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {isClosing ? (
                            <>
                              <CheckCircle2 className="size-3.5" />
                              {viewing.status?.name || "Sudah Visit"}
                            </>
                          ) : (
                            <>
                              <XCircle className="size-3.5" />
                              {viewing.status?.name || "Gagal"}
                            </>
                          )}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEvidenceDialog(viewing)}
                          >
                            <UploadCloud className="size-3.5 mr-1.5" />
                            Upload Bukti
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => openFailDialog(viewing)}
                          >
                            <XCircle className="size-3.5 mr-1.5" />
                            Tandai Gagal
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={isEvidenceDialogOpen}
        onOpenChange={(open) => {
          setIsEvidenceDialogOpen(open);
          if (!open) {
            setSelectedViewing(null);
            evidenceForm.reset();
          }
        }}
      >
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Bukti Visit</DialogTitle>
            <DialogDescription>
              Upload bukti kunjungan. Setelah diunggah, status visit otomatis
              menjadi &quot;sudah visit&quot;.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...evidenceForm}>
            <form
              onSubmit={evidenceForm.handleSubmit(handleSubmitEvidence)}
              className="grid gap-4 py-2"
            >
              <FormFileUpload
                name="file"
                label="File Bukti"
                validation={{ required: "File wajib diunggah" }}
                helperText="PDF, JPG, atau PNG."
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <FormTextarea
                name="notes"
                label="Catatan (Opsional)"
                placeholder="Catatan tambahan tentang visit..."
                rows={3}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEvidenceDialogOpen(false)}
                  disabled={isUploadingEvidence}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploadingEvidence}>
                  {isUploadingEvidence ? "Mengunggah..." : "Upload Bukti"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFailDialogOpen}
        onOpenChange={(open) => {
          setIsFailDialogOpen(open);
          if (!open) {
            setSelectedViewing(null);
            failForm.reset();
          }
        }}
      >
        <DialogContent className="min-w-xl">
          <DialogHeader>
            <DialogTitle>Tandai Visit Gagal</DialogTitle>
            <DialogDescription>
              Berikan alasan visit ini tidak dapat dilaksanakan.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...failForm}>
            <form
              onSubmit={failForm.handleSubmit(handleSubmitFail)}
              className="grid gap-4 py-2"
            >
              <FormTextarea
                name="reason"
                label="Alasan (Opsional)"
                placeholder="Contoh: lead tidak hadir, force majeure..."
                rows={3}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFailDialogOpen(false)}
                  disabled={isFailing}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isFailing}
                >
                  {isFailing ? "Memproses..." : "Tandai Gagal"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
