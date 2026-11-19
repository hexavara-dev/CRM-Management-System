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
import { ImagePlus, Plus, Trash2 } from "lucide-react";
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
  const [basePrice] = useState(String(initial?.basePrice ?? ""));
  const [stock, setStock] = useState(initial ? String(initial.stock) : "");
  const [typeVariants, setTypeVariants] = useState(() =>
    initial?.typeVariants?.map((option) => ({ ...option, key: option.id ?? crypto.randomUUID(), basePriceText: String(option.basePrice), stockText: String(option.stock) }))
    ?? [{ key: crypto.randomUUID(), name: "Default", code: null, basePrice: 0, stock: 0, basePriceText: "", stockText: "", unitCount: 0 }],
  );
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
      stock: Number(stock),
      typeVariants: typeVariants.map((option) => ({
        ...(option.id ? { id: option.id } : {}), name: option.name, code: option.code,
        basePrice: Number(option.basePriceText), currentPrice: option.currentPrice ?? Number(option.basePriceText),
        minPrice: option.minPrice ?? null, stock: Number(option.stockText), unitCount: option.unitCount,
      })),
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
        <div className="space-y-3 rounded-lg border border-[#E4E4E7] p-3 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-xs font-semibold">Varian tipe</p><p className="text-[10px] font-normal text-[#667085]">Harga dan stock disimpan per varian.</p></div>
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setTypeVariants((items) => [...items, { key: crypto.randomUUID(), name: "", code: null, basePrice: 0, stock: 0, basePriceText: "", stockText: "", unitCount: 0 }])}><Plus className="mr-1 size-3.5" />Tambah</Button>
          </div>
          {typeVariants.map((option) => (
            <div key={option.key} className="grid gap-2 rounded-md bg-[#F8FAFC] p-2 sm:grid-cols-[1fr_0.75fr_1fr_auto]">
              <Input required value={option.name} placeholder="Nama varian" className="h-9" onChange={(event) => setTypeVariants((items) => items.map((item) => item.key === option.key ? { ...item, name: event.target.value } : item))} />
              <Input type="number" required min={option.unitCount ?? 0} value={option.stockText} placeholder="Stock" className="h-9" onChange={(event) => setTypeVariants((items) => items.map((item) => item.key === option.key ? { ...item, stockText: event.target.value } : item))} />
              <RupiahInput required value={option.basePriceText} placeholder="Harga dasar" className="h-9" onValueChange={(value) => setTypeVariants((items) => items.map((item) => item.key === option.key ? { ...item, basePriceText: value } : item))} />
              <Button type="button" variant="ghost" disabled={typeVariants.length === 1 || (option.unitCount ?? 0) > 0} className="h-9 px-2 text-[#D64545]" onClick={() => setTypeVariants((items) => items.filter((item) => item.key !== option.key))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
        <label className="hidden">
          Total unit
          <Input
            type="number"
            required
            min={initial?.unitCount ?? 0}
            max={2147483647}
            step="1"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder="0"
            className="h-9"
          />
          <p className="text-[10px] font-normal text-[#667085]">
            {Number(stock || 0).toLocaleString("id-ID")} slot total ·{" "}
            {(initial?.unitCount ?? 0).toLocaleString("id-ID")} unit sudah diatur.
            {initial && Number(stock || 0) < initial.unitCount
              ? ` Minimal ${initial.unitCount.toLocaleString("id-ID")} unit.`
              : ""}
          </p>
        </label>
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
              onFocus={(event) => event.currentTarget.select()}
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
