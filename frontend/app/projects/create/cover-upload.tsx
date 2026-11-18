"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverCropDialog } from "./cover-crop-dialog";

type Picked = { id: string; file: File; url: string };
type Pending = { id: string; file: File; url: string };

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
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Picked[]>([]);
  const pendingRef = useRef<Pending[]>([]);

  // Simpan daftar terbaru untuk cleanup, lalu lepas object URL saat unmount agar tidak bocor memori.
  useEffect(() => {
    itemsRef.current = items;
    onUrlsChange?.(items.map((i) => i.url));
    onFilesChange?.(items.map((i) => i.file));
  }, [items, onUrlsChange, onFilesChange]);
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
  }, []);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => {
    return () => pendingRef.current.forEach((i) => URL.revokeObjectURL(i.url));
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(list).filter((file) => allowed.includes(file.type) && file.size <= 30 * 1024 * 1024);
    setError(valid.length === list.length ? null : "Gunakan JPEG, PNG, atau WebP dengan ukuran sumber maksimal 30 MB.");
    const next = valid.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    if (next.length) setPending((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const saveCrop = (file: File) => {
    const current = pending[0];
    if (!current) return;
    const cropped = { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) };
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {existing.map((item) => (
          <div key={item.id} className="relative h-40 overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#F6F7F9]">
            <Image src={item.fileUrl} alt="Gambar proyek saat ini" fill unoptimized className="object-contain" />
            {item.isPrimary ? (
              <span className="absolute left-1.5 top-1.5 rounded bg-[#1980C0] px-1.5 py-0.5 text-[9px] font-medium text-white">Cover</span>
            ) : onMakePrimary && (
              <button type="button" onClick={() => onMakePrimary(item.id)} className="absolute bottom-1.5 left-1.5 rounded bg-white/95 px-2 py-1 text-[10px] font-medium">Jadikan cover</button>
            )}
            {onDeleteExisting && <button type="button" aria-label="Hapus gambar proyek" onClick={() => onDeleteExisting(item.id)} className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/95 text-[#1f1f1f] hover:text-[#D64545]"><X className="size-3.5" /></button>}
          </div>
        ))}
        {items.map((item, idx) => (
          <div key={item.id} className="relative h-40 overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#F6F7F9]">
            <Image src={item.url} alt={item.file.name} fill unoptimized className="object-contain" />
            {idx === 0 && existing.length === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded bg-[#1980C0] px-1.5 py-0.5 text-[9px] font-medium text-white">
                Cover
              </span>
            )}
            {idx > 0 && <button type="button" onClick={() => setItems((current) => {
              const chosen = current.find((entry) => entry.id === item.id);
              return chosen ? [chosen, ...current.filter((entry) => entry.id !== item.id)] : current;
            })} className="absolute bottom-1.5 left-1.5 rounded bg-white/95 px-2 py-1 text-[10px] font-medium">Jadikan cover</button>}
            <button
              type="button"
              aria-label={`Hapus ${item.file.name}`}
              onClick={() => removeItem(item.id)}
              className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/95 text-[#1f1f1f] shadow-sm hover:text-[#D64545]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#1980C0]/50 bg-[#F6FAFD] text-[11px] font-medium text-[#1980C0] hover:bg-[#E5F1FA]",
          )}
        >
          <ImagePlus className="size-5" />
          {items.length === 0 && existing.length === 0 ? "Pilih gambar" : "Tambah"}
        </button>
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
        Sumber gambar JPEG, PNG, atau WebP maksimal ukuran 30 MB.
      </p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
