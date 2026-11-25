"use client";

import { Banknote, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/helper";
import { cn } from "@/lib/utils";
import type { DealPayment, DealPaymentType } from "@/types/deal";

const paymentTypes: Array<{ type: DealPaymentType; label: string }> = [
  { type: "ITJ", label: "ITJ" },
  { type: "DP", label: "DP" },
  { type: "SETTLEMENT", label: "Pelunasan" },
];

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";

export function DealPaymentSummary({
  payments,
  onAddPayment,
}: {
  payments: DealPayment[];
  onAddPayment: () => void;
}) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center justify-between border-b border-[#EAECF0] pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
          <WalletCards className="size-4 text-[#1570EF]" />
          Ringkasan Transaksi
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddPayment}
          className="h-7 text-xs text-[#1570EF]"
        >
          Tambah
        </Button>
      </div>

      <div className="space-y-1">
        {paymentTypes.map(({ type, label }) => {
          const rows = payments.filter((payment) => payment.type === type);
          const amount = rows.reduce(
            (total, payment) => total + Number(payment.amount),
            0,
          );
          const paidRows = rows.filter((payment) => payment.status === "PAID");
          const isPaid = rows.length > 0 && paidRows.length === rows.length;
          const latestPaid = [...paidRows].sort(
            (left, right) =>
              new Date(right.paidAt || 0).getTime() -
              new Date(left.paidAt || 0).getTime(),
          )[0];

          return (
            <div
              key={type}
              className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-2 py-2 text-xs"
            >
              <span className="flex items-center gap-2 text-[#344054]">
                <Banknote className="size-4 text-[#667085]" /> {label}
              </span>
              <span className="font-semibold text-[#101828]">
                {amount ? formatRupiah(amount) : "—"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  isPaid
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : "bg-[#F2F4F7] text-[#667085]",
                )}
              >
                {isPaid ? "Lunas" : "—"}
              </span>
              <span className="w-20 text-right text-[#667085]">
                {formatDate(latestPaid?.paidAt)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
