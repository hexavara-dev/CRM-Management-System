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
import { RupiahInput } from "@/components/ui/rupiah-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ProjectTypeRow,
  TYPE_ATTRIBUTES,
  type TypeAttributeCode,
  useCreateProjectType,
  useUpdateProjectType,
} from "@/hooks/use-project-types";
import { ImagePlus } from "lucide-react";
import { useState } from "react";

type ProjectOption = { id: string; name: string };

const EMPTY_ATTRIBUTES: Record<TypeAttributeCode, number> = {
  building_area: 0,
  surface_area: 0,
  floors: 0,
  bedroom: 0,
  bathroom: 0,
  carport: 0,
};

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
  const [basePrice, setBasePrice] = useState(String(initial?.basePrice ?? ""));
  const [attributes, setAttributes] = useState<
    Record<TypeAttributeCode, number>
  >(initial?.attributes ?? EMPTY_ATTRIBUTES);
  const [image, setImage] = useState<File>();
  const pending = createType.isPending || updateType.isPending;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      projectId,
      name,
      basePrice: Number(basePrice),
      attributes,
      image,
    };

    if (initial) {
      updateType.mutate(
        {
          ...payload,
          variantId: initial.id,
          attributeRows: initial.attributeRows,
        },
        { onSuccess: onClose },
      );
      return;
    }
    createType.mutate(payload, { onSuccess: onClose });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium text-[#344054] sm:col-span-2">
          Proyek
          {initial ? (
            <Input value={initial.projectName} disabled className="h-9" />
          ) : (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Pilih proyek" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>
        <label className="space-y-1.5 text-xs font-medium text-[#344054] sm:col-span-2">
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
        <label className="space-y-1.5 text-xs font-medium text-[#344054]">
          Harga dasar
          <RupiahInput
            required
            value={basePrice}
            onValueChange={setBasePrice}
            placeholder="650000000"
            className="h-9"
          />
        </label>
        <div className="space-y-1.5 text-xs font-medium text-[#344054]">
          <p>Total unit</p>
          <div className="flex h-9 items-center rounded-md border border-[#D0D5DD] bg-[#F9FAFB] px-3 text-sm text-[#344054]">
            {initial?.unitCount ?? 0} unit
          </div>
          <p className="text-[10px] font-normal text-[#667085]">
            Dihitung dari unit yang terhubung ke tipe ini.
          </p>
        </div>
        {TYPE_ATTRIBUTES.map((attribute) => (
          <label
            key={attribute.code}
            className="space-y-1.5 text-xs font-medium text-[#344054]"
          >
            {attribute.name}
            {attribute.unit ? ` (${attribute.unit})` : ""}
            <Input
              type="number"
              min="0"
              step="1"
              value={attributes[attribute.code]}
              onChange={(event) =>
                setAttributes((current) => ({
                  ...current,
                  [attribute.code]: Number(event.target.value),
                }))
              }
              className="h-9"
            />
          </label>
        ))}
        <label className="space-y-1.5 text-xs font-medium text-[#344054] sm:col-span-2">
          Gambar tipe (opsional)
          <span className="flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-[#D0D5DD] px-3 py-2 text-xs font-normal text-[#667085]">
            <ImagePlus className="size-4 shrink-0" />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImage(event.target.files?.[0])}
              className="min-w-0 flex-1 file:mr-2 file:rounded-md file:border-0 file:bg-[#EFF6FF] file:px-2 file:py-1 file:text-xs file:text-[#175CD3]"
            />
          </span>
        </label>
      </div>
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
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
