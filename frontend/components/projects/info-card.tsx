export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] bg-white">
      <h3 className="border-b border-[#EDEDED] px-3 py-2 text-xs font-semibold text-[#1f1f1f]">{title}</h3>
      <div className="p-3">{children}</div>
    </div>
  );
}
