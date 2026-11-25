/** Batas kualitas encoder; nilai di antaranya dicari per gambar. */
const MIN_QUALITY = 0.82;
const MAX_QUALITY = 0.92;
/** Kemiripan minimal terhadap gambar sebelum dikompres (1 = identik). */
const MIN_SIMILARITY = 0.97;
const SEARCH_STEPS = 5;

/** Sisi terpanjang foto yang disimpan utuh (foto proyek, tipe, dan unit). */
export const PHOTO_MAX_EDGE = 1600;

type Source = HTMLImageElement | HTMLCanvasElement | ImageBitmap;
type Area = { x: number; y: number; width: number; height: number };

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Browser tidak dapat memproses gambar ini.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

/** Potong dan perkecil bertahap (maksimal setengah per langkah) agar detail tetap tajam. */
export function resizeToCanvas(source: Source, area: Area, width: number, height: number): HTMLCanvasElement {
  let current: Source = source;
  let from = area;
  for (;;) {
    const nextWidth = Math.max(width, from.width / 2);
    const nextHeight = Math.max(height, from.height / 2);
    const { canvas, context } = createCanvas(nextWidth, nextHeight);
    // Area transparan diisi putih.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(current, from.x, from.y, from.width, from.height, 0, 0, canvas.width, canvas.height);
    if (nextWidth <= width && nextHeight <= height) return canvas;
    current = canvas;
    from = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

function luminance(context: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = context.getImageData(0, 0, width, height);
  const values = new Float32Array(width * height);
  for (let i = 0, p = 0; i < values.length; i++, p += 4) {
    values[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return values;
}

/** Rata-rata SSIM luminans pada blok 8x8. */
function similarity(a: Float32Array, b: Float32Array, width: number, height: number) {
  const size = 8;
  let total = 0;
  let blocks = 0;
  for (let y = 0; y + size <= height; y += size) {
    for (let x = 0; x + size <= width; x += size) {
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      for (let dy = 0; dy < size; dy++) {
        const row = (y + dy) * width + x;
        for (let i = row; i < row + size; i++) {
          sumA += a[i];
          sumB += b[i];
          sumAA += a[i] * a[i];
          sumBB += b[i] * b[i];
          sumAB += a[i] * b[i];
        }
      }
      const n = size * size;
      const meanA = sumA / n;
      const meanB = sumB / n;
      const varA = sumAA / n - meanA * meanA;
      const varB = sumBB / n - meanB * meanB;
      const cov = sumAB / n - meanA * meanB;
      total +=
        ((2 * meanA * meanB + 6.5025) * (2 * cov + 58.5225)) /
        ((meanA * meanA + meanB * meanB + 6.5025) * (varA + varB + 58.5225));
      blocks++;
    }
  }
  return blocks ? total / blocks : 1;
}

/** Berkas terkecil yang masih mirip dengan aslinya. WebP; JPEG bila browser tidak mendukung. */
export async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const { width, height } = canvas;
  const context = canvas.getContext("2d");
  const probe = await toBlob(canvas, "image/webp", MAX_QUALITY);
  const type = probe?.type === "image/webp" ? "image/webp" : "image/jpeg";
  let best = type === "image/webp" ? probe : await toBlob(canvas, type, MAX_QUALITY);
  if (!context || !best || best.type !== type) throw new Error("Gagal memproses gambar.");

  const original = luminance(context, width, height);
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  for (let step = 0; step < SEARCH_STEPS; step++) {
    // Langkah pertama langsung mencoba kualitas terendah; sebagian besar foto sudah cukup di sana.
    const quality = step === 0 ? low : (low + high) / 2;
    const blob = await toBlob(canvas, type, quality);
    if (!blob) break;
    const bitmap = await createImageBitmap(blob);
    const decoded = createCanvas(width, height);
    decoded.context.drawImage(bitmap, 0, 0);
    bitmap.close();
    if (similarity(original, luminance(decoded.context, width, height), width, height) >= MIN_SIMILARITY) {
      if (blob.size < best.size) best = blob;
      if (step === 0) break;
      high = quality;
    } else {
      low = quality;
    }
  }
  return best;
}

export const imageFileName = (name: string, blob: Blob, suffix = "") =>
  `${name.replace(/\.[^.]+$/, "")}${suffix}.${blob.type === "image/webp" ? "webp" : "jpg"}`;

/** Kecilkan sisi terpanjang dan kompres tanpa memotong. Berkas asli dipakai bila sudah lebih kecil. */
export async function compressImage(file: File, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = resizeToCanvas(
      bitmap,
      { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const blob = await encodeCanvas(canvas);
    if (blob.size >= file.size) return file;
    return new File([blob], imageFileName(file.name, blob), { type: blob.type });
  } finally {
    bitmap.close();
  }
}
