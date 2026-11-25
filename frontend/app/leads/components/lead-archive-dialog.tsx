"use client";

import { useEffect, useState } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ArchiveCategory } from "@/hooks/use-lead-archive";

type LeadArchiveDialogProps = {
  open: boolean;
  leadName?: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    category: ArchiveCategory;
    reason?: string;
  }) => Promise<void>;
};

export function LeadArchiveDialog({
  open,
  leadName,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: LeadArchiveDialogProps) {
  const [category, setCategory] = useState<ArchiveCategory>("NOT_RESPOND");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setCategory("NOT_RESPOND");
      setReason("");
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      await onSubmit({ category, reason: reason.trim() || undefined });
      onOpenChange(false);
    } catch {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arsipkan Lead</DialogTitle>
          <DialogDescription>
            {leadName ? `${leadName} akan ` : "Lead akan "}
            disembunyikan dari daftar aktif. Aktivitas dan dokumen tetap
            tersimpan.
          </DialogDescription>
        </DialogHeader>

        <label className="grid gap-1.5 text-sm font-medium">
          Kategori arsip
          <Select
            value={category}
            disabled={isSubmitting}
            onValueChange={(value) => setCategory(value as ArchiveCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_RESPOND">Not Respond</SelectItem>
              <SelectItem value="INVALID">Invalid</SelectItem>
              <SelectItem value="NOT_QUALIFIED">Not Qualified</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Alasan (opsional)
          <Textarea
            value={reason}
            maxLength={500}
            disabled={isSubmitting}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24"
          />
          <span className="text-right text-xs text-muted-foreground">
            {reason.length}/500
          </span>
        </label>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "Mengarsipkan..." : "Arsipkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
