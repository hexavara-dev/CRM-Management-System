export function DetailStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#6b6b6b]">{icon}</span>
      <div>
        <div className="text-[#6b6b6b]">{label}</div>
        <div className="font-semibold text-[#1f1f1f]">{value}</div>
      </div>
    </div>
  );
}
