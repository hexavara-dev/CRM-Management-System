"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { CoverCropDialog } from "./cover-crop-dialog";
import { PROJECT_COVER_HEIGHT, PROJECT_COVER_WIDTH } from "./cover-image";

type Picked = { id: string; file: File; url: string };
type Pending = { id: string; file: File; url: string };
type DeleteTarget =
  | { kind: "existing"; id: string }
  | { kind: "new"; id: string; name: string };

const MAX_PROJECT_COVERS = 5;

/** Ukuran kotak thumbnail sampul, mengikuti mockup. */
const TILE = "relative h-[180px] w-[135px] shrink-0 overflow-hidden rounded-lg";

export function CoverGuide() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setPinned(false);
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => {
            if (!pinned) setOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => {
            const nextPinned = !pinned;
            setPinned(nextPinned);
            setOpen(nextPinned);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#1980C0] hover:bg-[#E8F3FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1980C0]/40"
          aria-label="Tampilkan panduan ukuran cover"
          aria-expanded={open}
        >
          <Info className="size-3.5" />
          Panduan cover
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={6}
        align="end"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        className="w-72 gap-1 bg-foreground px-3 py-2 text-xs text-background"
      >
        <p className="font-semibold">Gunakan gambar banner lebar</p>
        <p className="leading-4 text-background/85">
          Ukuran yang disarankan {PROJECT_COVER_WIDTH} × {PROJECT_COVER_HEIGHT}
          px (rasio 10:3) agar cover memenuhi area tanpa banyak bagian
          terpotong.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function CoverUpload({
  name = "cover",
  onUrlsChange,
  onFilesChange,
  existing = [],
  onMakePrimary,
  onDeleteExisting,
}: {
  name?: string;
  onUrlsChange?: (urls: string[]) => void;
  onFilesChange?: (files: File[]) => void;
  existing?: { id: string; fileUrl: string; isPrimary: boolean }[];
  onMakePrimary?: (id: string) => void;
  onDeleteExisting?: (id: string) => void;
}) {
  const [items, setItems] = useState<Picked[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Picked[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  const remainingSlots = Math.max(0, MAX_PROJECT_COVERS - existing.length - items.length);

  // Simpan daftar terbaru untuk cleanup, lalu lepas object URL saat unmount agar tidak bocor memori.
  useEffect(() => {
    itemsRef.current = items;
    onUrlsChange?.(items.map((i) => i.url));
    onFilesChange?.(items.map((i) => i.file));
  }, [items, onUrlsChange, onFilesChange]);
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
  }, []);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    return () => pendingRef.current.forEach((i) => URL.revokeObjectURL(i.url));
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(list).filter(
      (file) => allowed.includes(file.type) && file.size <= 30 * 1024 * 1024,
    );
    const accepted = valid.slice(0, remainingSlots);
    setError(
      valid.length !== list.length
        ? "Gunakan JPEG, PNG, atau WebP dengan ukuran sumber maksimal 30 MB."
        : valid.length > remainingSlots
          ? `Maksimal ${MAX_PROJECT_COVERS} gambar sampul. Hanya ${remainingSlots} gambar tambahan yang dapat dipilih.`
          : null,
    );
    const next = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));
    if (next.length) setPending((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const saveCrop = (file: File) => {
    const current = pending[0];
    if (!current) return;
    const cropped = {
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    };
    setItems((prev) => [...prev, cropped]);
    URL.revokeObjectURL(current.url);
    setPending((prev) => prev.slice(1));
    setError(null);
  };

  const cancelCrop = () => {
    pending.forEach((item) => URL.revokeObjectURL(item.url));
    setPending([]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "existing") {
      onDeleteExisting?.(deleteTarget.id);
    } else {
      removeItem(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-2">
      {pending[0] && (
        <CoverCropDialog
          key={pending[0].id}
          file={pending[0].file}
          url={pending[0].url}
          onSave={saveCrop}
          onCancel={cancelCrop}
        />
      )}
      <div className="flex flex-wrap gap-3">
        {existing.slice(0, MAX_PROJECT_COVERS).map((item) => (
          <div
            key={item.id}
            className={cn(TILE, "bg-[#F6F7F9]")}
          >
            <Image
              src={item.fileUrl}
              alt="Gambar proyek saat ini"
              fill
              unoptimized
              className="object-cover"
            />
            {item.isPrimary ? (
              <span className="absolute left-1.5 top-1.5 rounded bg-[#1980C0] px-1.5 py-0.5 text-[9px] font-medium text-white">
                Cover
              </span>
            ) : (
              onMakePrimary && (
                <button
                  type="button"
                  onClick={() => onMakePrimary(item.id)}
                  className="absolute bottom-1.5 left-1.5 cursor-pointer rounded bg-white/95 px-2 py-1 text-[10px] font-medium"
                >
                  Jadikan cover
                </button>
              )
            )}
            {onDeleteExisting && (
              <button
                type="button"
                aria-label="Hapus gambar proyek"
                onClick={() =>
                  setDeleteTarget({ kind: "existing", id: item.id })
                }
                className="absolute right-1.5 top-1.5 grid size-6 cursor-pointer place-items-center rounded-full border border-[#E4E4E7] bg-white text-[#475467] shadow-sm hover:text-[#D64545]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {items.slice(0, remainingSlots + items.length).map((item, idx) => (
          <div
            key={item.id}
            className={cn(TILE, "bg-[#F6F7F9]")}
          >
            <Image
              src={item.url}
              alt={item.file.name}
              fill
              unoptimized
              className="object-cover"
            />
            {idx === 0 && existing.length === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded bg-[#1980C0] px-1.5 py-0.5 text-[9px] font-medium text-white">
                Cover
              </span>
            )}
            {idx > 0 && (
              <button
                type="button"
                onClick={() =>
                  setItems((current) => {
                    const chosen = current.find(
                      (entry) => entry.id === item.id,
                    );
                    return chosen
                      ? [
                          chosen,
                          ...current.filter((entry) => entry.id !== item.id),
                        ]
                      : current;
                  })
                }
                className="absolute bottom-1.5 left-1.5 cursor-pointer rounded bg-white/95 px-2 py-1 text-[10px] font-medium"
              >
                Jadikan cover
              </button>
            )}
            <button
              type="button"
              aria-label={`Hapus ${item.file.name}`}
              onClick={() =>
                setDeleteTarget({
                  kind: "new",
                  id: item.id,
                  name: item.file.name,
                })
              }
              className="absolute right-1.5 top-1.5 grid size-6 cursor-pointer place-items-center rounded-full border border-[#E4E4E7] bg-white text-[#475467] shadow-sm hover:text-[#D64545]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {remainingSlots > 0 && <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            TILE,
            "flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-[#9ca3af] bg-white text-xs text-[#6b6b6b] hover:border-[#1980C0] hover:text-[#1980C0]",
          )}
        >
          <ImagePlus className="size-12 text-[#D0D5DD]" strokeWidth={1.5} />
          Tambah Baru
        </button>}
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <p className="text-[10px] text-[#6b6b6b]">
        Format JPEG, PNG, atau WebP dengan ukuran sumber maksimal 30 MB.
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hapus gambar?"
        description={
          deleteTarget?.kind === "new"
            ? `Gambar “${deleteTarget.name}” akan dihapus dari daftar upload. Anda dapat memilihnya kembali jika diperlukan.`
            : "Gambar ini akan dihapus dari proyek. Tindakan ini tidak dapat dibatalkan setelah perubahan proyek disimpan."
        }
        cancelLabel="Batal"
        confirmLabel="Hapus"
      />
    </div>
  );
}
