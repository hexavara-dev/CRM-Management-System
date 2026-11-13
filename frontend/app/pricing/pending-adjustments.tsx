"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/hooks/use-projects";
import {
  formatDay,
  formatPrice,
  formatSigned,
  usePendingAdjustments,
  useReviewAdjustment,
  type PriceAdjustment,
} from "@/hooks/use-unit-prices";

export function PendingAdjustments({ canWrite }: { canWrite: boolean }) {
  const [page, setPage] = useState(1);
  const pending = usePendingAdjustments(page);
  const review = useReviewAdjustment();
  const [rejecting, setRejecting] = useState<PriceAdjustment | null>(null);
  const [note, setNote] = useState("");

  const rows = pending.data?.data ?? [];
  const totalPages = Math.max(1, pending.data?.meta.totalPages ?? 1);

  if (pending.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (pending.isError) {
    return (
      <div className="rounded-xl border border-dashed border-[#D64545]/40 py-16 text-center text-sm text-[#D64545]">
        {errorMessage(pending.error, "Gagal memuat pengajuan.")}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
        Tidak ada pengajuan yang menunggu approval.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#E4E4E7]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Project · Tipe</TableHead>
              <TableHead className="text-right">Harga lama</TableHead>
              <TableHead className="text-right">Harga baru</TableHead>
              <TableHead className="text-right">Minimum</TableHead>
              <TableHead>Efektif</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Pengaju</TableHead>
              {canWrite && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.unit?.code}</TableCell>
                <TableCell className="text-[#6b6b6b]">
                  {row.unit?.variant.product.name} · {row.unit?.variant.name}
                </TableCell>
                <TableCell className="text-right">{formatPrice(row.priceBefore)}</TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-[#D9822B]">{formatPrice(row.priceAfter)}</span>
                  <span className="block text-[10px] text-[#6b6b6b]">{formatSigned(row.priceAfter - row.priceBefore)}</span>
                </TableCell>
                <TableCell className="text-right">{row.minPrice === null ? "-" : formatPrice(row.minPrice)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDay(row.effectiveDate)}</TableCell>
                <TableCell className="max-w-48 truncate" title={row.reason}>
                  {row.reason}
                </TableCell>
                <TableCell>{row.requestedBy?.name ?? "-"}</TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-[#D64545] px-2 text-xs text-[#D64545]"
                        disabled={review.isPending}
                        onClick={() => {
                          setNote("");
                          setRejecting(row);
                        }}
                      >
                        Tolak
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 rounded-lg bg-[#1980C0] px-2 text-xs text-white hover:bg-[#166ea6]"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: row.id, decision: "approve" })}
                      >
                        Setujui
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak penyesuaian {rejecting?.unit?.code}</DialogTitle>
            <DialogDescription>Catatan penolakan wajib diisi dan tersimpan di riwayat harga.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            maxLength={500}
            rows={4}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Alasan penolakan"
            aria-label="Alasan penolakan"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              Batal
            </Button>
            <Button
              type="button"
              className="bg-[#D64545] text-white hover:bg-[#b93a3a]"
              disabled={!note.trim() || review.isPending}
              onClick={async () => {
                if (!rejecting) return;
                try {
                  await review.mutateAsync({ id: rejecting.id, decision: "reject", note: note.trim() });
                  setRejecting(null);
                } catch {
                  // Pesan error ditampilkan oleh mutation.
                }
              }}
            >
              {review.isPending ? "Memproses..." : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
