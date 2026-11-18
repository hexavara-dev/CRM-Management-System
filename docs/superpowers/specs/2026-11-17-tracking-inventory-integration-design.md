# Tracking Method × Existing Inventory — Design

Tanggal: 2026-11-17
Referensi: Existing Inventory Module, `2026-11-16-inventory-tracking-settings-design.md`, `2026-11-17-product-tracking-method-design.md`.
Prasyarat: fitur Product Tracking Method (kolom `products.tracking_type`) sudah selesai.

## Tujuan

Pencatatan dan perhitungan stok mengikuti metode tracking produk, memakai data inventory yang sudah ada, tanpa membangun modul inventory baru.

## Inventory existing

| Data | Dipakai oleh | Sifat |
|---|---|---|
| `product_units` (kode, status, lokasi) | Projects (unitSummary), Availability, Pricing, Reservation | Unit-based |
| `product_variants.stock` | Wizard (kuota pembagian unit) | Jumlah, belum dipakai untuk perhitungan |
| `item` / `entry` / `record` | Tidak dipakai frontend | Di luar cakupan, tidak disentuh |

Masalah saat ini: produk unit-based menyimpan stok dua kali, sebagai `variant.stock` dan sebagai jumlah unit, dan keduanya bisa berbeda.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Sumber stok Unit-Based | Jumlah baris `product_units` per tipe. `variant.stock` diselaraskan otomatis dengan jumlah unit dan tidak bisa diubah manual. |
| 2 | Sumber stok Quantity-Based | `product_variants.stock`. Produk tidak memiliki unit. |
| 3 | Pencatatan Quantity-Based | Ubah stok tipe lewat endpoint varian yang ada (`PUT /api/products/:id/variants/:variantId`, field `stock`). Hanya untuk produk `QUANTITY`. |
| 4 | Pencatatan Unit-Based | Tetap lewat unit (kode/identitas, status). Field `stock` pada varian produk `UNIT` ditolak (409). |
| 5 | Status Quantity-Based | Belum ada reservasi/terjual per jumlah; seluruh stok dihitung **available**. |
| 6 | Modul unit-based | Pricing dan Reservation tetap hanya untuk produk `UNIT` (produk `QUANTITY` tidak punya unit, jadi otomatis tidak muncul). |
| 7 | Data lama | Migrasi data: `variant.stock` produk `UNIT` diisi ulang dengan jumlah unit tipenya. |

## Backend

Aturan stok (`stockRules.ts`):
```
stockOf(variant, product) =
  product.trackingType === 'UNIT' ? jumlah unit tipe : variant.stock
```

Perubahan:
- **Create produk**: produk `UNIT` → `stock` tiap tipe diisi jumlah unit tipe itu (nilai dari klien diabaikan). Produk `QUANTITY` → `stock` dari klien.
- **Update varian**: `stock` hanya untuk produk `QUANTITY`; produk `UNIT` → 409 "Stock of unit-based products follows their units".
- **Add varian**: produk `UNIT` → `stock` selalu 0.
- **Ringkasan project** (`GET /api/products`, `GET /api/products/:id`): `unitSummary` produk `QUANTITY` dihitung dari stok (`total = available = Σ stock`), produk `UNIT` tetap dari unit. Respons menambah `trackingType`.
- **Availability**:
  - Overview menyertakan produk `QUANTITY` dengan ringkasan dari stok.
  - Detail project `QUANTITY`: `clusters` kosong dan `types: [{ id, name, stock }]` untuk ditampilkan per tipe.
  - Endpoint cluster/unit untuk produk `QUANTITY` → 404.
- Migrasi data keputusan 7 (UPDATE dengan subquery jumlah unit).

## Frontend

- **Detail project**: produk `QUANTITY` menampilkan tabel stok per tipe (Tipe, Stok) sebagai pengganti Unit Distribution; produk `UNIT` tidak berubah.
- **Kartu project & ringkasan**: label "Units" menjadi "Stock" untuk produk `QUANTITY`; Sold/Reserved 0.
- **Availability**: baris project `QUANTITY` menampilkan stok; halaman detailnya menampilkan stok per tipe tanpa grid unit.
- **Ubah stok Quantity-Based**: dialog "Ubah stok" per tipe di detail project (owner), memakai endpoint varian.
- **Wizard**: produk `UNIT` tidak lagi meminta stok manual di langkah Tipe Unit; jumlah diambil dari unit yang dibuat. Produk `QUANTITY` tetap mengisi stok.

## Test

- `stockOf` untuk kedua metode.
- Create `UNIT` menyelaraskan stok dengan jumlah unit.
- Update stok varian: sukses untuk `QUANTITY`, 409 untuk `UNIT`.
- Ringkasan project dan Availability untuk produk `QUANTITY`.
- Test existing Projects/Availability/Pricing/Reservation tetap lulus.

## Di luar cakupan

- Reservasi dan penjualan berbasis jumlah (keluar-masuk stok, riwayat stok).
- Tabel lama `item` / `entry` / `record`.
- Penambahan unit setelah project dibuat.
