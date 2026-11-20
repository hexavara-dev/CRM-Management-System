import { TriangleAlert } from "lucide-react";

import type { AvailabilityIntegrity } from "@/components/availability/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AvailabilityIntegrityWarning({
  integrity,
}: {
  integrity?: AvailabilityIntegrity;
}) {
  if (!integrity || integrity.status !== "degraded") return null;

  const details = [
    integrity.ignoredUnitCount > 0
      ? `${integrity.ignoredUnitCount} unit diabaikan`
      : null,
    integrity.skippedCycleEdges > 0
      ? `${integrity.skippedCycleEdges} relasi hierarchy tidak valid diputus`
      : null,
  ].filter(Boolean);

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <TriangleAlert className="size-4 text-amber-600" />
      <AlertTitle className="text-xs font-semibold">
        Struktur hierarchy perlu diperiksa
      </AlertTitle>
      <AlertDescription className="text-[11px] leading-5 text-amber-800">
        Sebagian data tidak ditampilkan agar jumlah unit tetap konsisten.
        {details.length > 0 ? ` ${details.join(" · ")}.` : ""} Hubungi
        administrator untuk memeriksa konfigurasi proyek.
      </AlertDescription>
    </Alert>
  );
}
