import { cn } from "@/lib/utils";

export function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
      <p className={cn("text-xs font-medium", color)}>{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#1f1f1f]">{value}</p>
    </div>
  );
}
