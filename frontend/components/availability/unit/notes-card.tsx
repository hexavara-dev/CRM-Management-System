import { Info } from "lucide-react";

export function UnitNotesCard() {
  return (
    <div className="rounded-xl border border-[#dce9fb] bg-[#eef6ff] p-3">
      <div className="flex gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-[#3784ed]" />
        <div>
          <p className="text-[10px] font-bold text-[#376bb3]">Catatan:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[9px] leading-relaxed text-[#445a78]">
            <li>Hanya unit Available yang dapat dibuatkan reservasi.</li>
            <li>
              Isi data pemesan, sales, harga, dan status di formulir reservasi.
            </li>
            <li>
              Setelah reservasi tersimpan, unit berubah menjadi Reserved dan
              tidak tersedia untuk reservasi lain.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
