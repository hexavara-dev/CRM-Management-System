import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
  /** Keterangan kecil opsional di bawah nilai. */
  hint?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
      <p className={cn("text-xs font-medium", color)}>{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold text-[#1f1f1f]">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-[#6b6b6b]">{hint}</p>}
    </div>
  );
}
