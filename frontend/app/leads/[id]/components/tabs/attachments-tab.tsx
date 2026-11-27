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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FormInput } from "@/components/ui/form-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Attachment } from "@/lib/data";
import { formatDate } from "@/lib/helper";
import api from "@/lib/api";
import { Download, Eye, FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FormProvider, useForm } from "react-hook-form";

type AttachmentFormData = {
  name: string;
  file: FileList;
};

interface AttachmentsTabProps {
  attachments: Attachment[];
  /** Bila tidak diisi, tombol upload disembunyikan (dokumen hanya datang dari fitur lain). */
  onAddAttachment?: (data: AttachmentFormData) => void;
  entityLabel?: string;
}

type PreviewState = {
  name: string;
  type: string;
  url?: string;
  status: "loading" | "ready" | "error";
};

export function AttachmentsTab({
  attachments,
  onAddAttachment,
  entityLabel = "lead",
}: AttachmentsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewToken = useRef(0);

  // File diambil lewat API (membawa cookie login) lalu ditampilkan dari blob:
  // backend memaksa download untuk selain gambar, sehingga URL langsung tidak bisa ditampilkan inline.
  const openPreview = async (attachment: Attachment) => {
    const token = ++previewToken.current;
    setPreview({ name: attachment.name, type: attachment.fileType, status: "loading" });
    try {
      const response = await api.get<Blob>(attachment.fileUrl, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data], { type: attachment.fileType }));
      if (token !== previewToken.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setPreview({ name: attachment.name, type: attachment.fileType, url, status: "ready" });
    } catch {
      if (token === previewToken.current) {
        setPreview({ name: attachment.name, type: attachment.fileType, status: "error" });
      }
    }
  };

  // Download sungguhan: <a download> diabaikan browser untuk URL lintas-origin,
  // sehingga file diambil lewat API lalu disimpan dari blob.
  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await api.get<Blob>(attachment.fileUrl, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data], { type: attachment.fileType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Gagal mengunduh dokumen.");
    }
  };

  const closePreview = () => {
    previewToken.current += 1;
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const form = useForm<AttachmentFormData>({
    defaultValues: {
      name: "",
    },
  });

  const handleSubmit = (data: AttachmentFormData) => {
    onAddAttachment?.(data);
    form.reset();
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Dokumen & Evidence
          </h2>
          <p className="text-sm text-muted-foreground">
            Kelola dokumen, proposal, dan evidence yang berkaitan dengan Lead.
          </p>
        </div>
        {onAddAttachment && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8">
              <Upload className="size-3.5 mr-1.5" />
              Upload Dokumen
            </Button>
          </DialogTrigger>
          <DialogContent className="min-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Attachment</DialogTitle>
              <DialogDescription>
                Upload a document for this {entityLabel}.
              </DialogDescription>
            </DialogHeader>
            <FormProvider {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="grid gap-4 py-4"
              >
                <FormInput
                  name="name"
                  label="File Name"
                  validation={{
                    required: "File name is required",
                  }}
                  placeholder="Enter file name"
                />
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Select File</label>
                  <input
                    type="file"
                    {...form.register("file", {
                      required: "File is required",
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Upload</Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {attachments.length === 0 ? (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Paperclip className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No files attached</EmptyTitle>
            <EmptyDescription>
              {onAddAttachment
                ? `Upload important documents related to this ${entityLabel} for easy access.`
                : "Belum ada dokumen. Dokumen yang diunggah saat menambah aktivitas akan muncul di sini."}
            </EmptyDescription>
          </EmptyHeader>
          {onAddAttachment && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
            >
              Upload first file
            </Button>
          )}
        </Empty>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Nama Dokumen</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>Tanggal Upload</TableHead>
                <TableHead>Pengunggah</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((attachment) => (
                <TableRow key={attachment.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded border bg-muted/30 flex items-center justify-center shrink-0">
                        <FileText className="size-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-sm truncate">
                        {attachment.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {attachment.activityLabel ? "Dokumen Aktivitas" : "Dokumen Lead"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-normal uppercase px-1.5"
                    >
                      {attachment.fileType.split("/").pop()}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground"
                    title={attachment.activityLabel ?? "Tidak terkait aktivitas"}
                  >
                    {attachment.activityLabel ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(attachment.uploadedAt)}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground"
                    title={attachment.uploadedByName ?? "Pengunggah tidak tercatat"}
                  >
                    {attachment.uploadedByName ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Preview ${attachment.name}`}
                        title={`Preview ${attachment.name}`}
                        onClick={() => void openPreview(attachment)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Download ${attachment.name}`}
                        title={`Download ${attachment.name}`}
                        onClick={() => void downloadAttachment(attachment)}
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent className="flex h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="truncate text-base">{preview?.name}</DialogTitle>
            <DialogDescription>Pratinjau dokumen</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4">
            {preview?.status === "loading" && (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            )}
            {preview?.status === "error" && (
              <p className="text-sm text-muted-foreground">
                Dokumen tidak dapat dimuat. Coba lagi atau gunakan tombol download.
              </p>
            )}
            {preview?.status === "ready" && preview.url && (
              preview.type === "application/pdf" ? (
                <iframe title={preview.name} src={preview.url} className="size-full rounded-md bg-white" />
              ) : preview.type.startsWith("image/") ? (
                <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pratinjau tidak tersedia untuk tipe file ini. Gunakan tombol download.
                </p>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
