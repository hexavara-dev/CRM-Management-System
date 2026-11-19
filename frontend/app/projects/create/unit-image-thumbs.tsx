"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_THUMBS = 3;
// Referensi stabil: default array baru di tiap render akan memicu effect berulang.
const NO_FILES: File[] = [];
const NO_URLS: string[] = [];

function BrokenThumb({ title }: { title: string }) {
  // Sengaja bukan button: gambar kosong/rusak tidak bisa diklik dan tidak membuka preview.
  return (
    <div role="img" aria-label={title} title={title} className="grid size-10 shrink-0 cursor-default place-items-center rounded-md border border-dashed border-[#D9D9DE] bg-[#F6F7F9] text-[#9CA3AF]">
      <ImageOff className="size-4" />
    </div>
  );
}

/**
 * Thumbnail gambar unit + preview besar saat diklik.
 * Sumber gambar: `urls` (sudah tersimpan di server) dan `files` (baru dipilih, dipreview lewat object URL).
 * Tanpa gambar atau gambar gagal dimuat → placeholder tidak bisa diklik (placeholder=false menyembunyikannya).
 */
export function UnitImageThumbs({ files = NO_FILES, urls = NO_URLS, label, placeholder = false }: { files?: File[]; urls?: string[]; label: string; placeholder?: boolean }) {
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<number | null>(null);

  // Object URL dibuat dari File dan dilepas saat daftar file berubah atau komponen dilepas.
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setFileUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const sources = [...urls, ...fileUrls];
  const working = sources.filter((src) => !broken.has(src));
  const hidden = sources.slice(MAX_THUMBS).filter((src) => !broken.has(src));
  const markBroken = (src: string) => setBroken((current) => new Set(current).add(src));

  const open = preview !== null && working.length > 0;
  const current = open ? Math.min(preview, working.length - 1) : 0;
  const move = (offset: number) => setPreview((index) => (index === null ? index : (index + offset + working.length) % working.length));

  useEffect(() => {
    if (!open || working.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, working.length]);

  // File baru dipilih tetapi object URL-nya belum dibuat (satu frame): tahan tempatnya agar tidak berkedip jadi placeholder.
  if (files.length > 0 && fileUrls.length !== files.length) return <div className="size-10" />;
  if (sources.length === 0) return placeholder ? <BrokenThumb title="Belum ada gambar" /> : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {sources.slice(0, MAX_THUMBS).map((src, idx) =>
          broken.has(src) ? (
            <BrokenThumb key={src} title="Gambar tidak dapat dimuat" />
          ) : (
            <button key={src} type="button" aria-label={`Lihat gambar ${idx + 1} ${label}`} onClick={() => setPreview(working.indexOf(src))} className="cursor-pointer overflow-hidden rounded-md border border-[#E4E4E7] transition hover:border-[#1980C0] hover:ring-2 hover:ring-[#1980C0]/30">
              <Image src={src} alt="" width={40} height={40} unoptimized onError={() => markBroken(src)} className="size-10 object-cover" />
            </button>
          ),
        )}
        {hidden.length > 0 && (
          <button type="button" aria-label={`Lihat ${hidden.length} gambar lainnya`} onClick={() => setPreview(working.indexOf(hidden[0]))} className="grid size-10 cursor-pointer place-items-center rounded-md border border-[#E4E4E7] bg-[#F6F7F9] text-[11px] font-medium text-[#6b6b6b] hover:border-[#1980C0] hover:text-[#1980C0]">
            +{sources.length - MAX_THUMBS}
          </button>
        )}
      </div>
      <Dialog open={open} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="flex h-[min(85vh,720px)] max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden bg-white p-4 text-[#1f1f1f] sm:max-w-3xl">
          <div className="pr-10">
            <DialogTitle>Preview Gambar</DialogTitle>
            <DialogDescription className="text-xs text-[#6b6b6b]">{label} · {current + 1} / {working.length}</DialogDescription>
          </div>
          <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-lg bg-[#F4F4F5]">
            {working[current] && <Image src={working[current]} alt={`${label} gambar ${current + 1}`} fill unoptimized className="object-contain" />}
            {working.length > 1 && (
              <>
                {/* Posisi tengah memakai inset-y-0 + my-auto, bukan translate: Button punya active:translate-y yang menggeser tombol saat ditekan. */}
                <Button type="button" variant="outline" size="icon" onClick={() => move(-1)} aria-label="Gambar sebelumnya" className="absolute inset-y-0 left-3 z-10 my-auto rounded-full border-[#E4E4E7] bg-white text-[#1f1f1f] shadow-md hover:bg-[#F4F4F5]">
                  <ChevronLeft />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => move(1)} aria-label="Gambar berikutnya" className="absolute inset-y-0 right-3 z-10 my-auto rounded-full border-[#E4E4E7] bg-white text-[#1f1f1f] shadow-md hover:bg-[#F4F4F5]">
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
          {working.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
              {working.map((src, idx) => (
                <button key={src} type="button" aria-label={`Tampilkan gambar ${idx + 1}`} aria-current={idx === current} onClick={() => setPreview(idx)} className={cn("relative h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-[#F4F4F5]", idx === current ? "border-[#1980C0]" : "border-transparent opacity-65 hover:opacity-100")}>
                  <Image src={src} alt="" fill unoptimized className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
