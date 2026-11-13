import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Grid2X2,
  House,
  LandPlot,
  Layers3,
  Ruler,
} from "lucide-react";
import type { UnitDetail } from "./types";

export function UnitInfoCard({ unit }: { unit: UnitDetail }) {
  const details = [
    { icon: Grid2X2, label: "Cluster", value: unit.cluster },
    { icon: Layers3, label: "Blok", value: unit.block },
    { icon: House, label: "Tipe", value: unit.type },
    { icon: Ruler, label: "Luas Bangunan", value: unit.buildingArea },
    { icon: LandPlot, label: "Luas Tanah", value: unit.landArea },
  ];
  return (
    <Card className="rounded-xl border-[#e7ebf0] shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[20px] font-bold text-[#101828]">
            Unit {unit.number}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1dc] px-3 py-1.5 text-[10px] font-semibold text-[#eb7e00]">
            <CalendarDays className="size-3.5" />
            {unit.status}
          </span>
        </div>
        <div className="mt-4 space-y-2.5">
          {details.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="grid grid-cols-[18px_100px_10px_1fr] items-center"
              >
                <Icon className="size-3.5 text-[#667085]" />
                <span className="text-[11px] font-medium text-[#475467]">
                  {item.label}
                </span>
                <span className="text-[11px] text-[#98a2b3]">:</span>
                <span className="text-[11px] font-semibold text-[#344054]">
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
