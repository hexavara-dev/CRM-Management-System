import { cn } from "@/lib/utils";

const FALLBACK = "#94A3B8";

/** Teks putih untuk warna gelap, gelap untuk warna terang. */
function textColor(hex: string) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  return (r! * 299 + g! * 587 + b! * 114) / 1000 > 160 ? "#1f1f1f" : "#ffffff";
}

/** Satu tahapan berbentuk panah (chevron). */
export function StageChevron({
  name,
  color,
  first,
  className,
}: {
  name: string;
  color: string | null;
  first?: boolean;
  className?: string;
}) {
  const fill = color ?? FALLBACK;
  return (
    <div
      className={cn(
        "flex h-12 min-w-36 flex-1 items-center justify-center px-7 text-center text-sm font-semibold",
        className,
      )}
      style={{
        backgroundColor: fill,
        color: textColor(fill),
        clipPath: first
          ? "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)"
          : "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)",
      }}
    >
      <span className="line-clamp-2">{name}</span>
    </div>
  );
}

/** Pita tahapan berurutan; dapat digeser horizontal di layar kecil. */
export function StageChevrons({ stages }: { stages: { id: string; name: string; color: string | null }[] }) {
  if (stages.length === 0) {
    return <p className="py-3 text-center text-sm text-[#6b6b6b]">Belum ada tahapan aktif.</p>;
  }
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-0.5">
        {stages.map((stage, index) => (
          <StageChevron key={stage.id} name={stage.name} color={stage.color} first={index === 0} />
        ))}
      </div>
    </div>
  );
}
