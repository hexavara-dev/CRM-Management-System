"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageItems } from "@/lib/pagination";

/** Ringkasan "Menampilkan a–b dari n" dan tombol halaman untuk daftar yang dipaginasi di client. */
export function SimplePagination({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Menampilkan {start}–{end} dari {total} {itemLabel}
      </p>
      {totalPages > 1 && (
        <nav aria-label={`Halaman ${itemLabel}`} className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Halaman sebelumnya"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          {pageItems(page, totalPages).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground" aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === page ? "default" : "ghost"}
                size="icon-sm"
                aria-label={`Halaman ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Halaman berikutnya"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}
