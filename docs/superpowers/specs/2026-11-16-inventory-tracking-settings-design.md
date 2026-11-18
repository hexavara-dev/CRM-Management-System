# Inventory Tracking Settings — Design

Tanggal: 2026-11-16
Referensi: Global Inventory Tracking Configuration; `2026-11-07-product-management-design.md` keputusan 6–7.

## Tujuan

Owner menentukan metode pencatatan inventory yang berlaku untuk seluruh sistem (per company): **Quantity-Based Only**, **Unit-Based Only**, atau **Both Methods**.

## Kondisi saat ini

- `companies.tracking_type` (`QUANTITY` | `UNIT`, default `UNIT`) sudah ada tetapi tidak dipakai di kode mana pun, dan belum mendukung "Both".
- Seluruh fitur produk saat ini berbasis unit (`product_units`): Projects, Pricing, Availability, Reservation.
- Inventory berbasis jumlah hanya ada di tabel lama `item`/`entry`/`record` melalui CRUD generik, tanpa halaman.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Hak akses | Mengubah: owner saja (tahap awal). Membaca: semua user yang login. |
| 2 | Cakupan | Opsi 1 — simpan konfigurasi dan terapkan ke fitur berbasis unit yang sudah ada. Modul inventory berbasis jumlah dan `products.tracking_type` di luar cakupan. |
| 3 | Default | Company yang sudah ada `UNIT`; company baru `BOTH`. |
| 4 | Konflik data | Beralih ke `QUANTITY` ditolak (409) bila masih ada unit. `UNIT` dan `BOTH` selalu boleh. Dicek di backend. |
| 5 | Penyimpanan | Kolom ERD `company.tracking_type`, ditambah nilai `BOTH` (bukan kolom baru). |

## Database

Memakai kolom ERD tim yang sudah ada, `company.tracking_type` (migrasi `20261112090000_align_product_erd`), dan hanya menambah nilai `BOTH`:

```sql
ALTER TABLE `company` MODIFY `tracking_type` ENUM('QUANTITY', 'UNIT', 'BOTH') NOT NULL DEFAULT 'BOTH';
```

- `QUANTITY` = Quantity-Based Only, `UNIT` = Unit-Based Only, `BOTH` = Both Methods.
- Company yang sudah ada tetap `UNIT`; company baru default `BOTH`. Tidak ada kolom yang dihapus.
- ERD tim perlu diperbarui dengan nilai `BOTH`.

## Aturan

```
unitTrackingEnabled(mode)     = mode !== QUANTITY
quantityTrackingEnabled(mode) = mode !== UNIT
```

- Saat mode `QUANTITY`, backend menolak pembuatan unit baru (409 "Unit-based tracking is disabled") di `POST /api/products` (satu-satunya tempat `product_units` dibuat).
- Endpoint baca tidak diblokir, agar data lama tetap bisa dilihat bila ada.

## API

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/company/inventory-tracking` | Login | `{ mode, unitTrackingEnabled, quantityTrackingEnabled, unitCount, projectCount }` |
| PATCH | `/api/company/inventory-tracking` | Owner | Body `{ mode: "QUANTITY" \| "UNIT" \| "BOTH" }`. Field lain ditolak. 409 bila konflik (keputusan 4), pesan menyebut jumlah unit dan project. |

Tenant diambil dari JWT. Use case `InventoryTrackingUseCase` (get, update) dengan controller tipis.

## Frontend

- Tab baru **Inventory Tracking** di `/settings`.
- Tiga kartu pilihan (radio) dengan judul, penjelasan, dan contoh:
  - Quantity-Based Only — stok dihitung per jumlah (mis. material, aksesori).
  - Unit-Based Only — setiap unit dicatat satu per satu (mis. rumah A-01).
  - Both Methods — keduanya dapat dipakai.
- Tombol Simpan aktif bila pilihan berubah. Non-owner: kartu read-only dengan keterangan "Hanya owner yang dapat mengubah".
- Pilihan Quantity-Based Only nonaktif dengan keterangan jumlah unit bila `unitCount > 0`.
- Hook `useInventoryTracking()` dan `useUpdateInventoryTracking()`; invalidasi key setelah simpan; toast sukses/gagal.
- Saat `unitTrackingEnabled = false`: menu Product Management, Availability & Reservation, dan Pricing disembunyikan dari sidebar.

## Test

- Use case: get mengembalikan mode + jumlah unit; update owner sukses; `QUANTITY_ONLY` ditolak bila ada unit; tenant di-scope dari aktor.
- Validasi: mode di luar enum ditolak.
- Guard pembuatan unit saat `QUANTITY_ONLY`.

## Di luar cakupan

- `products.tracking_type` dan pilihan tipe di wizard.
- Modul inventory berbasis jumlah.
- Hak akses granular selain owner.
