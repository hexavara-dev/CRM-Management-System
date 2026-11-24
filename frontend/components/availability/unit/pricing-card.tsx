import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Percent, ShoppingBag } from "lucide-react";
import { formatRupiah } from "./format";
import type { UnitDetail } from "./types";

export function PricingCard({
  unit,
  onReserve,
  onSimulate,
}: {
  unit: UnitDetail;
  onReserve: () => void;
  onSimulate: () => void;
}) {
  return (
    <Card className="rounded-2xl border-[#e7ebf0] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#475467]">
              Harga Unit
            </p>
            <p className="mt-1.5 text-2xl font-bold leading-none text-[#101828]">
              {formatRupiah(unit.price)}
            </p>
          </div>
          <div className="flex min-w-[150px] items-center gap-2.5 rounded-xl bg-[#e9ffe9] px-3.5 py-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#caffca]">
              <Percent className="size-5 text-[#25ad38]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#20a936]">Promo</p>
              <p className="text-sm font-bold text-[#159b2c]">
                - {formatRupiah(unit.promo)}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-[#e9f2ff] px-4 py-3">
          <p className="text-sm font-medium text-[#4b6593]">
            Harga Setelah Promo
          </p>
          <p className="mt-1 text-2xl font-bold text-[#075bea]">
            {formatRupiah(unit.finalPrice)}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <Button
            className="h-11 w-full rounded-xl bg-[#0878ff] text-sm font-semibold hover:bg-[#006be8]"
            onClick={onReserve}
            disabled={unit.status !== "Available"}
          >
            <ShoppingBag className="mr-2 size-4" />
            {unit.status === "Available"
              ? "Pesan Unit Ini"
              : "Unit Tidak Tersedia"}
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl border-[#1684ff] text-sm font-semibold text-[#126df5] shadow-none hover:bg-[#f2f7ff] hover:text-[#126df5]"
            onClick={onSimulate}
          >
            <Calculator className="mr-2 size-4" />
            Simulasi KPR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
