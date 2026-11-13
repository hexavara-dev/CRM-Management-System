import { CalendarCheck2, CalendarDays, CircleX, Clock3 } from "lucide-react";
import type { ComponentType } from "react";
import type { ReservationSummaryData } from "./reservation-types";

type SummaryCard = {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  color: string;
  iconSurface: string;
};

export function ReservationSummary({
  summary,
}: {
  summary: ReservationSummaryData;
}) {
  const cards: SummaryCard[] = [
    {
      label: "Total Reservasi",
      value: summary.total,
      icon: CalendarDays,
      color: "text-primary",
      iconSurface: "bg-brand-100",
    },
    {
      label: "Aktif (Berlaku)",
      value: summary.active,
      icon: CalendarCheck2,
      color: "text-success",
      iconSurface: "bg-success-bg",
    },
    {
      label: "Menunggu Pembayaran",
      value: summary.paymentPending,
      icon: Clock3,
      color: "text-warning",
      iconSurface: "bg-warning-bg",
    },
    {
      label: "Kedaluwarsa",
      value: summary.expired,
      icon: CircleX,
      color: "text-danger",
      iconSurface: "bg-danger-bg",
    },
  ];

  return (
    <section
      aria-label="Ringkasan reservasi"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className="flex min-h-24 items-center gap-4 rounded-xl bg-card px-4 py-4 shadow-[0_6px_20px_rgba(16,45,85,0.08)]"
        >
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${card.iconSurface}`}
          >
            <card.icon className={`size-5 ${card.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>
              {card.value}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
