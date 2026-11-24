export function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#6b6b6b] [&_svg]:size-5">{icon}</span>
      <div className="leading-tight">
        <div className="text-lg font-semibold text-[#1f1f1f]">{value}</div>
        <div className="text-sm text-[#6b6b6b]">{label}</div>
      </div>
    </div>
  );
}
