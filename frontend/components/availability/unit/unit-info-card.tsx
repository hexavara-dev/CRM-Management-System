import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Grid2X2,
  House,
  LandPlot,
  Layers3,
  Ruler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitDetail } from "./types";

/** Warna badge mengikuti status unit, sama dengan badge di daftar unit. */
const STATUS_STYLE: Record<string, string> = {
  Available: "bg-[#ebffed] text-[#26a940]",
  Reserved: "bg-[#fff1dc] text-[#eb7e00]",
  Processing: "bg-[#e8f2ff] text-[#2378df]",
  Sold: "bg-[#eeeeee] text-[#333333]",
  Blocked: "bg-[#f2f4f7] text-[#667085]",
};

export function UnitInfoCard({ unit }: { unit: UnitDetail }) {
  const locationLabel =
    unit.locationLevel.charAt(0) + unit.locationLevel.slice(1).toLowerCase();
  const details = [
    { icon: Grid2X2, label: locationLabel, value: unit.location },
    ...(unit.block !== "—" && unit.block !== unit.location
      ? [{ icon: Layers3, label: "Blok", value: unit.block }]
      : []),
    { icon: House, label: "Tipe", value: unit.type },
    { icon: Ruler, label: "Luas Bangunan", value: unit.buildingArea },
    { icon: LandPlot, label: "Luas Tanah", value: unit.landArea },
  ];
  return (
    <Card className="rounded-2xl border-[#e7ebf0] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 border-b border-[#eef1f4] pb-4">
          <h2 className="text-2xl font-bold text-[#101828]">
            Unit {unit.number}
          </h2>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold", STATUS_STYLE[unit.status] ?? STATUS_STYLE.Blocked)}>
            <CalendarDays className="size-4" />
            {unit.status}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {details.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="grid grid-cols-[28px_130px_14px_1fr] items-center"
              >
                <Icon className="size-5 text-[#475467]" />
                <span className="text-sm font-medium text-[#475467]">
                  {item.label}
                </span>
                <span className="text-sm text-[#98a2b3]">:</span>
                <span className="text-sm font-semibold text-[#344054]">
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
