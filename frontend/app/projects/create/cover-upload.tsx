"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Picked = { id: string; file: File; url: string };

export function CoverUpload({
  name = "cover",
  onUrlsChange,
  onFilesChange,
}: {
  name?: string;
  onUrlsChange?: (urls: string[]) => void;
  onFilesChange?: (files: File[]) => void;
}) {
  const [items, setItems] = useState<Picked[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Picked[]>([]);

  // Simpan daftar terbaru untuk cleanup, lalu lepas object URL saat unmount agar tidak bocor memori.
  useEffect(() => {
    itemsRef.current = items;
    onUrlsChange?.(items.map((i) => i.url));
    onFilesChange?.(items.map((i) => i.file));
  }, [items, onUrlsChange, onFilesChange]);
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    if (next.length) setItems((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item, idx) => (
          <div key={item.id} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#F6F7F9]">
            <Image src={item.url} alt={item.file.name} fill unoptimized className="object-cover" />
            {idx === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded bg-[#1980C0] px-1.5 py-0.5 text-[9px] font-medium text-white">
                Cover
              </span>
            )}
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
            "flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#1980C0]/50 bg-[#F6FAFD] text-[11px] font-medium text-[#1980C0] hover:bg-[#E5F1FA]",
          )}
        >
          <ImagePlus className="size-5" />
          {items.length === 0 ? "Pilih gambar" : "Tambah"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <p className="text-[10px] text-[#6b6b6b]">
        {items.length === 0 ? "Belum ada gambar dipilih. Gambar pertama akan jadi cover." : `${items.length} gambar dipilih. Gambar pertama jadi cover.`}
      </p>
    </div>
  );
}
