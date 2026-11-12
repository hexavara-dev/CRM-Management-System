export function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#6b6b6b]">{icon}</span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-[#1f1f1f]">{value}</div>
        <div className="text-[11px] text-[#6b6b6b]">{label}</div>
      </div>
    </div>
  );
}
