"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
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
  PROJECT_COVER_ASPECT,
  PROJECT_COVER_HEIGHT,
  PROJECT_COVER_WIDTH,
} from "./cover-image";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MIN_SCALE = 0.25;

type Props = {
  file: File;
  url: string;
  onSave: (file: File) => void;
  onCancel: () => void;
};

type Drag = {
  mode: "move" | "resize";
  pointerX: number;
  pointerY: number;
  centerX: number;
  centerY: number;
  scale: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function CoverCropDialog({ file, url, onSave, onCancel }: Props) {
  const [frameElement, setFrameElement] = useState<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [image, setImage] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!frameElement) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setFrame({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(frameElement);
    return () => observer.disconnect();
  }, [frameElement]);

  const ready =
    frame.width > 0 && frame.height > 0 && image.width > 0 && image.height > 0;
  const fit = ready
    ? Math.min(frame.width / image.width, frame.height / image.height)
    : 0;
  const displayWidth = image.width * fit;
  const displayHeight = image.height * fit;
  const imageLeft = (frame.width - displayWidth) / 2;
  const imageTop = (frame.height - displayHeight) / 2;
  const maxCropWidth = Math.min(
    displayWidth,
    displayHeight * PROJECT_COVER_ASPECT,
  );
  const cropWidth = maxCropWidth * scale;
  const cropHeight = cropWidth / PROJECT_COVER_ASPECT;
  const halfX = displayWidth ? cropWidth / displayWidth / 2 : 0.5;
  const halfY = displayHeight ? cropHeight / displayHeight / 2 : 0.5;
  const centerX = clamp(center.x, halfX, 1 - halfX);
  const centerY = clamp(center.y, halfY, 1 - halfY);
  const cropLeft = imageLeft + centerX * displayWidth - cropWidth / 2;
  const cropTop = imageTop + centerY * displayHeight - cropHeight / 2;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    const resize =
      event.target instanceof Element &&
      !!event.target.closest("[data-resize-handle]");
    const insideCrop =
      event.target instanceof Element &&
      !!event.target.closest("[data-crop-area]");
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextCenter = insideCrop
      ? { x: centerX, y: centerY }
      : {
          x: clamp(
            (event.clientX - bounds.left - imageLeft) / displayWidth,
            halfX,
            1 - halfX,
          ),
          y: clamp(
            (event.clientY - bounds.top - imageTop) / displayHeight,
            halfY,
            1 - halfY,
          ),
        };

    if (!insideCrop) setCenter(nextCenter);
    dragRef.current = {
      mode: resize ? "resize" : "move",
      pointerX: event.clientX,
      pointerY: event.clientY,
      centerX: nextCenter.x,
      centerY: nextCenter.y,
      scale,
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    if (drag.mode === "resize") {
      setScale(
        clamp(
          drag.scale + (dx + dy * PROJECT_COVER_ASPECT) / (2 * maxCropWidth),
          MIN_SCALE,
          1,
        ),
      );
    } else {
      setCenter({
        x: clamp(drag.centerX + dx / displayWidth, halfX, 1 - halfX),
        y: clamp(drag.centerY + dy / displayHeight, halfY, 1 - halfY),
      });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-0.01, 0],
      ArrowRight: [0.01, 0],
      ArrowUp: [0, -0.01],
      ArrowDown: [0, 0.01],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setCenter({
      x: clamp(centerX + direction[0], halfX, 1 - halfX),
      y: clamp(centerY + direction[1], halfY, 1 - halfY),
    });
  };

  const save = async () => {
    const source = imageRef.current;
    if (!ready || !source?.complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = PROJECT_COVER_WIDTH;
      canvas.height = PROJECT_COVER_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Browser tidak dapat memproses gambar ini.");
      // JPEG tidak mendukung transparansi; area transparan diisi putih.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, PROJECT_COVER_WIDTH, PROJECT_COVER_HEIGHT);
      const sourceWidth = Math.min(image.width, cropWidth / fit);
      const sourceHeight = Math.min(image.height, cropHeight / fit);
      context.drawImage(
        source,
        clamp((cropLeft - imageLeft) / fit, 0, image.width - sourceWidth),
        clamp((cropTop - imageTop) / fit, 0, image.height - sourceHeight),
        sourceWidth,
        sourceHeight,
        0,
        0,
        PROJECT_COVER_WIDTH,
        PROJECT_COVER_HEIGHT,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.88),
      );
      if (!blob || blob.type !== "image/jpeg")
        throw new Error("Gagal membuat hasil crop JPEG.");
      if (blob.size > MAX_UPLOAD_BYTES)
        throw new Error("Hasil crop melebihi 10 MB. Coba gambar lain.");
      const baseName = file.name.replace(/\.[^.]+$/, "");
      onSave(new File([blob], `${baseName}-cover.jpg`, { type: "image/jpeg" }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal memotong gambar.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atur crop cover</DialogTitle>
          <DialogDescription>
            Geser kotak putih atau tarik langsung pada gambar untuk memilih
            area.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={setFrameElement}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => {
            dragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          className="relative aspect-video w-full cursor-move touch-none select-none overflow-hidden rounded-lg bg-[#F4F6F8]"
        >
          {/* Blob preview harus dimuat langsung; gambar berukuran awal 0px dapat tertunda oleh lazy loading. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- Pratinjau blob lokal untuk editor canvas */}
          <img
            ref={imageRef}
            src={url}
            alt={file.name}
            loading="eager"
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0)
                setImage({ width: naturalWidth, height: naturalHeight });
              else setError("Gambar tidak dapat dibuka. Pilih berkas lain.");
            }}
            onError={() =>
              setError("Gambar tidak dapat dibuka. Pilih berkas lain.")
            }
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              left: ready ? imageLeft : 0,
              top: ready ? imageTop : 0,
              width: ready ? displayWidth : "100%",
              height: ready ? displayHeight : "100%",
              objectFit: ready ? "fill" : "contain",
            }}
          />
          {!ready && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-600">
              {error ? "Gambar gagal dimuat" : "Memuat gambar..."}
            </div>
          )}
          {ready && (
            <div
              data-crop-area
              role="group"
              aria-label="Area crop cover. Geser dengan mouse atau tombol panah. Anda juga dapat menggeser dari area gambar di luar kotak."
              tabIndex={0}
              onKeyDown={onKeyDown}
              className="absolute cursor-move touch-none border-2 border-white outline-none ring-inset focus-visible:ring-2 focus-visible:ring-blue-400"
              style={{
                left: cropLeft,
                top: cropTop,
                width: cropWidth,
                height: cropHeight,
                boxShadow: "0 0 0 100vmax rgba(0, 0, 0, 0.55)",
              }}
            >
              <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/50" />
              <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/50" />
              <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/50" />
              <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/50" />
              <span
                data-resize-handle
                className="absolute -bottom-1 -right-1 size-5 cursor-nwse-resize rounded-sm border-2 border-zinc-700 bg-white"
                aria-label="Ubah ukuran area crop"
              />
            </div>
          )}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0">Ukuran area</span>
          <input
            type="range"
            min="25"
            max="100"
            step="1"
            value={Math.round(scale * 100)}
            onChange={(event) => setScale(Number(event.target.value) / 100)}
            className="w-full accent-[#1980C0]"
            aria-label="Ukuran area crop"
          />
          <span className="w-10 text-right tabular-nums">
            {Math.round(scale * 100)}%
          </span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onCancel}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={!ready || !!error || saving}
            onClick={save}
            className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
          >
            {saving ? "Memproses..." : "Simpan crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
