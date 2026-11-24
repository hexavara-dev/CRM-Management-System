import { Card, CardContent } from "@/components/ui/card";
import {
  Bath,
  BedDouble,
  Car,
  House,
  LayoutTemplate,
  Ruler,
} from "lucide-react";
import type { UnitDetail } from "./types";

export function SpecificationCard({ unit }: { unit: UnitDetail }) {
  const icons = {
    bathroom: Bath,
    bedroom: BedDouble,
    carport: Car,
    building_area: House,
    land_area: Ruler,
  };
  return (
    <Card className="rounded-2xl border-[#e7ebf0] shadow-none">
      <CardContent className="p-5">
        <h2 className="border-b border-[#eef1f4] pb-3 text-lg font-bold text-[#101828]">
          Denah & Spesifikasi
        </h2>
        <div className="mt-5 grid grid-cols-[160px_1fr] gap-8">
          <div className="flex justify-center">
            {unit.floorPlan ? (
              <img
                src={unit.floorPlan}
                alt="Floor plan"
                className="h-[260px] w-[130px] object-contain"
              />
            ) : (
              <div className="flex h-[260px] w-[130px] items-center justify-center rounded-xl bg-[#f4f7fa]">
                <LayoutTemplate className="size-8 text-[#98a2b3]" />
              </div>
            )}
          </div>
          <div className="pt-2">
            <p className="mb-4 text-base font-bold text-[#101828]">
              Spesifikasi Bangunan
            </p>
            <div className="space-y-3.5">
              {unit.specifications.map((item) => {
                const Icon = icons[item.key as keyof typeof icons] ?? House;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <Icon className="size-5 text-[#344054]" />
                    <span className="text-sm font-medium text-[#344054]">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
