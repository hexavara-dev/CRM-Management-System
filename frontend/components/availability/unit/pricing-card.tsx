import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Percent, ShoppingBag } from "lucide-react";
import { formatRupiah } from "./format";
import type { UnitDetail } from "./types";

export function PricingCard({ unit }: { unit: UnitDetail }) {
  return (
    <Card className="rounded-xl border-[#e7ebf0] shadow-none">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold text-[#475467]">
              Harga Unit
            </p>
            <p className="mt-0.5 text-[21px] font-bold leading-none text-[#101828]">
              {formatRupiah(unit.price)}
            </p>
          </div>
          <div className="flex min-w-[130px] items-center gap-2 rounded-lg bg-[#e9ffe9] px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#caffca]">
              <Percent className="size-4 text-[#25ad38]" />
            </div>
            <div>
              <p className="text-[9px] font-semibold text-[#20a936]">Promo</p>
              <p className="text-[9px] font-bold text-[#159b2c]">
                - {formatRupiah(unit.promo)}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-[#e9f2ff] px-3 py-2.5">
          <p className="text-[9px] font-medium text-[#4b6593]">
            Harga Setelah Promo
          </p>
          <p className="mt-0.5 text-[18px] font-bold text-[#075bea]">
            {formatRupiah(unit.finalPrice)}
          </p>
        </div>
        <div className="mt-3 space-y-2">
          <Button className="h-10 w-full rounded-lg bg-[#0878ff] text-[11px] font-semibold hover:bg-[#006be8]">
            <ShoppingBag className="mr-2 size-4" />
            Pesan Unit Ini
          </Button>
          <Button
            variant="outline"
            className="h-10 w-full rounded-lg border-[#1684ff] text-[11px] font-semibold text-[#126df5] shadow-none hover:bg-[#f2f7ff] hover:text-[#126df5]"
          >
            <Calculator className="mr-2 size-4" />
            Simulasi KPR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
