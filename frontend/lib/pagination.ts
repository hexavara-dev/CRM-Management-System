/**
 * Nomor halaman yang ditampilkan pada pagination: halaman pertama, terakhir,
 * dan sekitar halaman aktif. "gap" menandai lompatan yang ditampilkan sebagai "…".
 * Contoh (halaman 5 dari 420): 1 … 4 5 6 … 420.
 */
export function pageItems(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [1, totalPages, page - 1, page, page + 1]
    .filter((item, index, list) => item >= 1 && item <= totalPages && list.indexOf(item) === index)
    .sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  pages.forEach((item, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && item - previous > 1) items.push("gap");
    items.push(item);
  });
  return items;
}
