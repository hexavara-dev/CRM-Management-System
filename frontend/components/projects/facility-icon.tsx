import { House, Landmark, ParkingSquare, Shapes, ShieldCheck, Trees, Waves } from "lucide-react";

const icons = {
  "shield-check": ShieldCheck,
  "parking-square": ParkingSquare,
  trees: Trees,
  waves: Waves,
  shapes: Shapes,
  landmark: Landmark,
  house: House,
};

export function FacilityIcon({ iconKey, className }: { iconKey: string | null; className?: string }) {
  const Icon = icons[iconKey as keyof typeof icons] ?? House;
  return <Icon className={className} aria-hidden="true" />;
}
