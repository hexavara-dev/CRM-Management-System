export type MapPreview = { embedUrl: string; lat?: number; lng?: number };
export type ParseResult = { ok: true; preview: MapPreview } | { ok: false; error: string };

const embedFor = (q: string) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;

const fromCoords = (lat: number, lng: number): ParseResult =>
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { ok: true, preview: { embedUrl: embedFor(`${lat},${lng}`), lat, lng } }
    : { ok: false, error: "Koordinat di luar jangkauan." };

const COORD_PAIR = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;

/**
 * Mengubah isian user menjadi URL preview peta tanpa API key.
 * Menerima: URL Google Maps (panjang), kode <iframe> "Sematkan peta", atau "lat, lng".
 * Link pendek (maps.app.goo.gl) tidak bisa diurai dari browser, jadi ditolak dengan petunjuk.
 */
export function parseMapsInput(raw: string): ParseResult {
  let text = raw.trim();
  if (!text) return { ok: false, error: "" };

  const iframeSrc = text.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1];
  if (iframeSrc) text = iframeSrc.replace(/&amp;/g, "&");

  const pair = text.match(COORD_PAIR);
  if (pair) return fromCoords(Number(pair[1]), Number(pair[2]));

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "Format tidak dikenali. Tempel URL Google Maps, kode embed, atau koordinat (lat, lng)." };
  }

  const host = url.hostname.toLowerCase();
  if (/(^|\.)goo\.gl$/.test(host) || /(^|\.)maps\.app\.goo\.gl$/.test(host)) {
    return {
      ok: false,
      error: "Link pendek tidak bisa dibaca. Buka link itu di browser, lalu salin URL panjang dari address bar (atau pakai Bagikan → Sematkan peta).",
    };
  }
  if (!/(^|\.)google\.[a-z.]+$/.test(host) || !url.pathname.startsWith("/maps")) {
    return { ok: false, error: "Bukan link Google Maps." };
  }

  // Kode "Sematkan peta": pakai URL embed apa adanya (host sudah divalidasi google.*).
  if (url.pathname.startsWith("/maps/embed")) {
    const lng = Number(text.match(/!2d(-?\d+\.\d+)/)?.[1]);
    const lat = Number(text.match(/!3d(-?\d+\.\d+)/)?.[1]);
    return {
      ok: true,
      preview: { embedUrl: url.toString(), ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}) },
    };
  }

  const place = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (place) return fromCoords(Number(place[1]), Number(place[2]));

  const view = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (view) return fromCoords(Number(view[1]), Number(view[2]));

  const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("ll");
  if (q) {
    const qPair = q.match(COORD_PAIR);
    return qPair ? fromCoords(Number(qPair[1]), Number(qPair[2])) : { ok: true, preview: { embedUrl: embedFor(q) } };
  }

  const name = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/)?.[1];
  if (name) return { ok: true, preview: { embedUrl: embedFor(decodeURIComponent(name.replace(/\+/g, " "))) } };

  return { ok: false, error: "Lokasi tidak ditemukan di link ini. Pastikan link menunjuk ke sebuah tempat." };
}
