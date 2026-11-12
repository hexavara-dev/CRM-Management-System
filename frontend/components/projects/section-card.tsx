export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] p-3">
      <h4 className="mb-3 text-xs font-semibold text-[#1f1f1f]">{title}</h4>
      {children}
    </div>
  );
}
