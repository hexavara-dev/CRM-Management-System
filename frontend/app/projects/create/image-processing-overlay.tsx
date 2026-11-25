/** Menutup layar selama kompres agar form tidak tersimpan sebelum gambar siap. */
export function ImageProcessingOverlay() {
  return (
    <div role="status" className="fixed inset-0 z-[1000] grid place-items-center bg-white/60 text-sm font-medium text-[#1980C0]">
      Memproses gambar...
    </div>
  );
}
