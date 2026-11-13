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
    <Card className="rounded-xl border-[#e7ebf0] shadow-none">
      <CardContent className="p-4">
        <h2 className="text-[15px] font-bold text-[#101828]">
          Denah & Spesifikasi
        </h2>
        <div className="mt-4 grid grid-cols-[130px_1fr] gap-6">
          <div className="flex justify-center">
            {unit.floorPlan ? (
              <img
                src={unit.floorPlan}
                alt="Floor plan"
                className="h-[215px] w-[105px] object-contain"
              />
            ) : (
              <div className="flex h-[215px] w-[105px] items-center justify-center rounded-lg bg-[#f4f7fa]">
                <LayoutTemplate className="size-8 text-[#98a2b3]" />
              </div>
            )}
          </div>
          <div className="pt-2">
            <p className="mb-4 text-[11px] font-bold text-[#101828]">
              Spesifikasi Bangunan
            </p>
            <div className="space-y-3">
              {unit.specifications.map((item) => {
                const Icon = icons[item.key as keyof typeof icons] ?? House;
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <Icon className="size-4 text-[#344054]" />
                    <span className="text-[11px] font-medium text-[#344054]">
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
