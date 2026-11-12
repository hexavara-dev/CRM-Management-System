import { cn } from "@/lib/utils";

export function MetricTile({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={cn("rounded-lg px-2 py-1.5 text-center", className)}>
      <p className="text-sm font-semibold leading-tight">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight opacity-80">{label}</p>
    </div>
  );
}
