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
import { Input } from "@/components/ui/input";
import { duplicateVariantName, TYPE_DIALOG_CLASS, TYPE_FORM_CLASS, VariantEditor } from "@/components/projects/variant-editor";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ImageProcessingOverlay } from "@/app/projects/create/image-processing-overlay";
import { compressImage, PHOTO_MAX_EDGE } from "@/lib/compress-image";
import { toast } from "sonner";
import {
  type ProjectTypeRow,
  useCreateProjectType,
  useUpdateProjectType,
} from "@/hooks/use-project-types";
import { newVariant, type VariantDraft } from "@/lib/unit-specs";
import { ImagePlus } from "lucide-react";
import { useState } from "react";

type ProjectOption = { id: string; name: string };

function TypeForm({
  projects,
  initial,
  onClose,
}: {
  projects: ProjectOption[];
  initial: ProjectTypeRow | null;
  onClose: () => void;
}) {
  const createType = useCreateProjectType();
  const updateType = useUpdateProjectType();
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    initial
      ? initial.typeVariants.map((option) => ({
          id: option.id,
          key: option.id ?? crypto.randomUUID(),
          name: option.name,
          code: option.code ?? "",
          stock: String(option.stock),
          basePrice: String(option.basePrice),
          specs: option.specs,
        }))
      : [newVariant("Default")],
  );
  const savedVariant = (variant: VariantDraft) => initial?.typeVariants.find((option) => option.id === variant.id);
  const [image, setImage] = useState<File>();
  const [processing, setProcessing] = useState(false);
  const pending = createType.isPending || updateType.isPending;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const duplicate = duplicateVariantName(variants);
    if (duplicate) {
      toast.error(duplicate);
      return;
    }
    const payload = {
      projectId,
      name,
      typeVariants: variants.map((variant) => {
        const saved = variant.id ? savedVariant(variant) : undefined;
        const basePrice = Number(variant.basePrice);
        return {
          ...(variant.id ? { id: variant.id } : {}),
          name: variant.name.trim(),
          code: variant.code || null,
          basePrice,
          currentPrice: saved?.currentPrice ?? basePrice,
          minPrice: saved?.minPrice ?? null,
          stock: Number(variant.stock),
          specs: variant.specs,
        };
      }),
      image,
    };

    if (initial) {
      updateType.mutate(
        {
          ...payload,
          variantId: initial.id,
        },
        { onSuccess: onClose },
      );
      return;
    }
    createType.mutate(payload, { onSuccess: onClose });
  };

  return (
    <form onSubmit={submit} className={TYPE_FORM_CLASS}>
      <VariantEditor
        variants={variants}
        onChange={setVariants}
        createdUnits={(variant) => (variant.id ? (savedVariant(variant)?.unitCount ?? 0) : 0)}
      >
        <div className="space-y-3">
        <div className="space-y-1.5 text-xs font-medium text-[#344054]">
          <span>Proyek</span>
          {initial ? (
            <Input value={initial.projectName} disabled className="h-9" />
          ) : (
            <SearchableSelect
              value={projectId || undefined}
              onChange={(value) => value && setProjectId(value)}
              clearable={false}
              placeholder="Pilih proyek"
              searchPlaceholder="Cari proyek..."
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              triggerClassName="h-9 bg-white text-sm font-normal"
            />
          )}
        </div>
        <label className="block space-y-1.5 text-xs font-medium text-[#344054]">
          Nama tipe
          <Input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: Type 36"
            className="h-9"
          />
        </label>
        <label className="block space-y-1.5 text-xs font-medium text-[#344054]">
          Gambar tipe (opsional)
          <span className="flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-[#D0D5DD] px-3 py-2 text-xs font-normal text-[#667085]">
            <ImagePlus className="size-4 shrink-0" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (event) => {
                const input = event.target;
                const file = input.files?.[0];
                input.value = "";
                if (!file) return;
                setProcessing(true);
                try {
                  setImage(await compressImage(file, PHOTO_MAX_EDGE));
                } catch {
                  toast.error("Gambar tidak dapat diproses. Pilih berkas lain.");
                } finally {
                  setProcessing(false);
                }
              }}
              className="min-w-0 flex-1 file:mr-2 file:rounded-md file:border-0 file:bg-[#EFF6FF] file:px-2 file:py-1 file:text-xs file:text-[#175CD3]"
            />
          </span>
          {image && <span className="block font-normal text-[#12833B]">Gambar terpilih: {image.name}</span>}
        </label>
        </div>
      </VariantEditor>
      {processing && <ImageProcessingOverlay />}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          Batal
        </Button>
        <Button
          type="submit"
          disabled={pending || !projectId}
          className="bg-[#0866FF] text-white hover:bg-[#0757D5]"
        >
          {pending
            ? "Menyimpan..."
            : initial
              ? "Simpan Perubahan"
              : "Tambah Tipe"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TypeDialog({
  open,
  projects,
  initial,
  onOpenChange,
}: {
  open: boolean;
  projects: ProjectOption[];
  initial: ProjectTypeRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={TYPE_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Tipe" : "Tambah Tipe"}</DialogTitle>
          <DialogDescription>
            Isi detail tipe unit. Data akan disimpan ke proyek yang dipilih.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <TypeForm
            key={initial?.id ?? "new-type"}
            projects={projects}
            initial={initial}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
