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
import { Download, Eye, FileText, Paperclip, Upload } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

type AttachmentFormData = {
  name: string;
  file: FileList;
};

interface AttachmentsTabProps {
  attachments: Attachment[];
  onAddAttachment: (data: AttachmentFormData) => void;
  entityLabel?: string;
}

export function AttachmentsTab({
  attachments,
  onAddAttachment,
  entityLabel = "lead",
}: AttachmentsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<AttachmentFormData>({
    defaultValues: {
      name: "",
    },
  });

  const handleSubmit = (data: AttachmentFormData) => {
    onAddAttachment(data);
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
      </div>

      {attachments.length === 0 ? (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Paperclip className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No files attached</EmptyTitle>
            <EmptyDescription>
              Upload important documents related to this {entityLabel} for easy
              access.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            Upload first file
          </Button>
        </Empty>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[35%]">Nama Dokumen</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tipe</TableHead>
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
                  <TableCell className="text-xs text-muted-foreground">Dokumen Lead</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-normal uppercase px-1.5"
                    >
                      {attachment.fileType.split("/").pop()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(attachment.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">-</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="size-8"><a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${attachment.name}`}><Eye className="size-3.5" /></a></Button>
                      <Button asChild variant="ghost" size="icon" className="size-8"><a href={attachment.fileUrl} download={attachment.name} aria-label={`Download ${attachment.name}`}><Download className="size-3.5" /></a></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
