# Product Tracking Method — Design

Tanggal: 2026-11-17
Referensi: Global Inventory Tracking Configuration (`2026-11-16-inventory-tracking-settings-design.md`) dan Product Configuration.
Lanjutan: fitur "Integrasi Tracking Method dengan Existing Inventory" dikerjakan setelah ini.

## Tujuan

Saat mode global **Both Methods** aktif, setiap produk (project) memilih satu metode tracking: **Quantity-Based** atau **Unit-Based**. Saat mode global hanya satu metode, produk otomatis mengikutinya dan pilihan disembunyikan.

## Kondisi saat ini

- `company.tracking_type` (`QUANTITY` | `UNIT` | `BOTH`) sudah ada dari fitur sebelumnya.
- `products.tracking_type` **tidak ada**: pernah ada lalu dihapus di migrasi `20261112090000_align_product_erd`.
- Semua produk yang ada memiliki unit (`product_units`), dibuat lewat wizard Create Project (4 langkah: Informasi → Tipe Unit → Hierarki & Unit → Preview).
- `product_variants.stock` diisi di wizard dan dipakai sebagai kuota pembagian unit.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Penyimpanan | Tambah lagi `products.tracking_type` (`QUANTITY` \| `UNIT`), memakai enum `TrackingType` yang sama tanpa nilai `BOTH`. Pemilik ERD dikabari. |
| 2 | Data lama | Produk yang sudah ada diisi `UNIT`. |
| 3 | Mode global satu metode | `UNIT` atau `QUANTITY`: `trackingType` produk diisi otomatis dari mode global; nilai lain dari klien ditolak. |
| 4 | Mode global `BOTH` | `trackingType` wajib dikirim saat membuat produk. |
| 5 | Satu metode per produk | Produk `QUANTITY` tidak boleh memiliki unit. Produk `UNIT` boleh memiliki unit. |
| 6 | Perubahan metode | Boleh diubah lewat update produk hanya selama produk belum memiliki unit dan seluruh stok tipenya 0; setelah itu terkunci (409). Metode baru tetap harus diizinkan mode global. |
| 7 | Pengaturan global | Beralih ke `UNIT` ditolak bila masih ada produk `QUANTITY`; beralih ke `QUANTITY` ditolak bila masih ada produk `UNIT` atau unit (memperluas aturan fitur sebelumnya). |
| 8 | Wizard | Diubah oleh kita (milik F), lalu F dikabari. |

## Database

Migrasi `add_product_tracking_type`:

```sql
ALTER TABLE `products` ADD COLUMN `tracking_type` ENUM('QUANTITY', 'UNIT', 'BOTH') NOT NULL DEFAULT 'UNIT';
```

- Default `UNIT` mengisi produk lama. Nilai `BOTH` hanya ada karena enum dipakai bersama; backend tidak pernah menyimpan `BOTH` di produk.
- Index `[tenantId, trackingType]` untuk pengecekan aturan 7.

## Aturan backend

`resolveTrackingType(globalMode, requested)`:

| Global | `requested` kosong | `requested = UNIT` | `requested = QUANTITY` |
|---|---|---|---|
| `UNIT` | `UNIT` | `UNIT` | 400 |
| `QUANTITY` | `QUANTITY` | 400 | `QUANTITY` |
| `BOTH` | 400 "trackingType is required" | `UNIT` | `QUANTITY` |

Pembuatan produk (`POST /api/products`):
- `trackingType` ditentukan dengan tabel di atas.
- `QUANTITY` + `units` tidak kosong → 400 "Quantity-based products cannot have units".
- Menggantikan guard fitur sebelumnya (`assertUnitTracking`) karena sudah tercakup.

Update produk (`PUT /api/products/:id`, field `trackingType`):
- Harus diizinkan mode global (tabel di atas).
- Ditolak 409 bila produk sudah memiliki unit atau stok tipe > 0.

Respons produk (list dan detail) menyertakan `trackingType`.

Pengaturan global (`PATCH /api/company/inventory-tracking`):
- `UNIT`: 409 bila ada produk `QUANTITY` (pesan menyebut jumlahnya).
- `QUANTITY`: 409 bila ada produk `UNIT` atau unit.
- `GET` menambah `quantityProductCount` dan `unitProductCount`.

## Frontend

Wizard Create Project:
- Langkah Informasi: field **Tracking Method** (dua kartu: Quantity-Based / Unit-Based) hanya tampil saat mode global `BOTH`; wajib dipilih. Pada mode satu metode tidak tampil dan payload tidak mengirim `trackingType`.
- Produk `QUANTITY`: langkah Hierarki & Unit dilewati, payload tanpa `units` dan `locations` unit; stok tipe tetap diisi di langkah Tipe Unit dengan label "Stock (Qty)".
- Preview menampilkan metode yang dipakai.

Daftar dan detail project:
- Badge metode (Quantity / Unit) pada kartu dan detail project saat mode global `BOTH`.

Settings → Inventory Tracking:
- Pilihan yang ditolak aturan 7 dinonaktifkan dengan keterangan jumlah produknya.

## Test

- `resolveTrackingType` untuk semua kombinasi.
- Create: `QUANTITY` dengan unit ditolak; `BOTH` tanpa `trackingType` ditolak; mode satu metode mengisi otomatis.
- Update: ganti metode sukses tanpa unit/stok; 409 bila ada unit atau stok; ditolak bila tidak diizinkan global.
- Pengaturan global: aturan 7.
- Validasi: `trackingType` di luar `QUANTITY`/`UNIT` ditolak.

## Di luar cakupan (fitur berikutnya)

- Perhitungan stok dan tampilan inventory berdasarkan metode (Availability, detail project).
- Pencegahan duplikasi `stock` vs jumlah unit pada produk `UNIT`.
- Halaman edit produk terpisah (belum ada); perubahan metode hanya via API.
