# Rencana Implementasi Product & Availability Management (P1)

**Tujuan:** Membangun P1 sesuai [dokumen desain](../specs/2026-11-07-product-management-design.md) dan ERD tim.

**Arsitektur:** Express dengan alur `presentation -> usecases -> infrastructure -> Prisma/MySQL`, serta Next.js dengan TanStack Query. Aturan stok dan harga berada di use case khusus, bukan CRUD generik.

**Stack:** Prisma 7, MySQL 8.0, Jest, Next.js 16, React Hook Form, Zod.

## Sebelum mulai

- [ ] Tim menyetujui `products.project_category_id` dan satu karakteristik per unit.
- [ ] Jumlah baris tabel lama sudah dicek di setiap environment dengan query di bawah.
- [ ] Backup database server dev tersedia sebelum migrasi diterapkan.

Semua hasil harus `0` sebelum Fase 2 di-deploy:

```bash
docker exec crm_db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" crm_engine -e "
SELECT \"item\" t, COUNT(*) n FROM item UNION ALL
SELECT \"item_category\", COUNT(*) FROM item_category UNION ALL
SELECT \"inventory_slot\", COUNT(*) FROM inventory_slot UNION ALL
SELECT \"grid_config\", COUNT(*) FROM grid_config UNION ALL
SELECT \"entry\", COUNT(*) FROM entry UNION ALL
SELECT \"operation\", COUNT(*) FROM operation UNION ALL
SELECT \"record\", COUNT(*) FROM record UNION ALL
SELECT \"lead_item\", COUNT(*) FROM lead_item UNION ALL
SELECT \"viewing.slot_id\", COUNT(*) FROM viewing WHERE slot_id IS NOT NULL;"'
```

Setiap task berakhir dengan commit tersendiri, dan setiap fase adalah satu PR. Jangan menjalankan `migrate reset` atau SQL destruktif pada database bersama tanpa izin eksplisit.

Verifikasi standar:

```bash
cd backend && npm run lint && npm run build && npm test -- --runInBand
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

## Urutan dan Jira

| Fase | Isi | Jira | Bergantung pada |
| --- | --- | --- | --- |
| 1 | `Tenant` menjadi `Company` | Belum ada kartu | |
| 2 | Backend produk, varian (unit type), atribut, karakteristik | CRM-31, CRM-32, CRM-33 | Kategori sementara |
| 3 | Backend media produk | CRM-34 | Fase 2 |
| 4 | Inventory kuantitas | CRM-30 | Fase 2 |
| 5 | Unit, price log, availability | Belum ada kartu | Fase 2 |

CRM-31 sampai CRM-34 hanya backend. Layarnya, termasuk langkah 2 "List Unit Type" di wizard Create Project, dikerjakan di epic CRM-2.

**Status:** Fase 2 dan 3 sudah dibuat di branch `feat/product-catalog`. Karena rename belum dikerjakan, tabel baru masih memakai `tenant_id`, dan `inventory_tracking_mode` sementara berada di tabel `tenant`.

**Kategori sementara:** migrasi `20261110085900_add_product_categories` hanya ada agar backend produk bisa berjalan sebelum PR CRM-2 masuk. Setelah PR CRM-2 masuk:

1. Hapus folder migrasi tersebut.
2. Pastikan migrasi `add_product_catalog` memiliki timestamp setelah migrasi kategori CRM-2.
3. Cocokkan nama tabel dan kolom kategori dengan relasi di `products`.

---

## Fase 1: `Tenant` menjadi `Company` (PR 1)

Tidak ada perubahan fitur pada fase ini.

### Task 1.1: Schema dan migrasi

- [ ] Ganti model `Tenant` menjadi `Company` dan `tenantId` menjadi `companyId` di semua model.
- [ ] Tambahkan `address` (nullable) dan `inventory_tracking_mode` (default `BOTH`) pada `company`.
- [ ] Buat migrasi dengan `npx prisma migrate dev --create-only`, lalu ganti drop dan create dengan `RENAME TABLE` dan `RENAME COLUMN`.
- [ ] Terapkan pada salinan database berisi data, dan pastikan jumlah baris sama.

### Task 1.2: Backend dan frontend

- [ ] Ganti `tenantId` dan `tenantName` di `backend/src`, `backend/tests`, `prisma/seed.ts`, klaim JWT, dan frontend.
- [ ] Token lama ditolak dengan 401, bukan 500. Tambahkan test.
- [ ] Perbarui istilah di `AGENTS.md`, `README.md`, dan `docs/`.
- [ ] Smoke test: register, login, lead, deal, kunjungan.
- [ ] Pastikan `grep -ri tenant backend/src backend/tests frontend/app frontend/hooks` kosong.

---

## Fase 2: Backend katalog (PR 2, CRM-31 sampai CRM-33)

- [x] Tambahkan `products`, `product_variants`, `product_attributes`, `characteristics`, dan `product_categories` sementara.
- [x] Test: `category_id` harus `CATEGORY`, `project_category_id` harus `PROJECT`, dan kategori dicari di tenant yang sama.
- [x] Test: `tracking_type` ditolak jika tidak diizinkan `inventory_tracking_mode`.
- [x] Test: produk dibuat bersama minimal satu varian dalam satu transaksi, dan varian terakhir tidak bisa dihapus.
- [x] Test: `variant_id` atribut harus milik produk, dan `value` sesuai `data_type`.
- [x] Test: kategori dengan siklus atau lebih dari 5 level ditolak, dan kategori yang dipakai tidak bisa dihapus.
- [x] Endpoint `/products`, varian, atribut, `/characteristics`, dan `/product-categories`.
- [ ] Hapus tabel lama (`Item`, `Entry`, dan seterusnya) di PR terpisah setelah isinya dicek.
- [ ] Smoke test API dengan database lokal.

---

## Fase 3: Backend media (PR 2, CRM-34)

- [x] Tambahkan `product_media`.
- [x] Test: tipe file selain JPEG, PNG, WebP, dan PDF ditolak sebelum disimpan, dan link non-`https` ditolak.
- [x] Satu media utama per produk atau varian, diganti dalam satu transaksi.
- [x] Menghapus media atau produk juga menghapus filenya.
- [x] Pakai ulang penyimpanan `uploads` dan middleware akses per tenant.
- [ ] Tambahkan `unit_id` saat `product_units` dibuat di Fase 5.

---

## Fase 4: Inventory kuantitas (PR 4, CRM-30)

- [ ] Tambahkan `inventory_balances` dan `inventory_transactions`.
- [ ] Test: setiap jenis transaksi mencatat nilai sebelum dan sesudah.
- [ ] Test: stock out dan transfer melebihi availability ditolak, transfer atomik dengan `transfer_ref` sama.
- [ ] Test: alasan wajib untuk adjustment dan opname.
- [ ] Test: saldo hanya di lokasi tanpa turunan, dan produk `UNIT` ditolak.
- [ ] Test integrasi MySQL: dua stock out bersamaan pada stok terakhir, hanya satu berhasil.
- [ ] Test: `tracking_type` terkunci setelah ada saldo atau transaksi.
- [ ] Implementasikan `InventoryUseCases` sebagai satu-satunya jalur perubahan saldo.
- [ ] Halaman `/inventory/quantity`.

---

## Fase 5: Unit, harga, dan availability (PR 5)

- [ ] Tambahkan `product_units` dan `product_variant_price_logs`.
- [ ] Test: unit hanya untuk produk `UNIT`, `category_id` harus `BLOCK` di bawah proyek produk, dan kode unik.
- [ ] Test: registrasi massal gagal seluruhnya jika ada kode bentrok.
- [ ] Test: transisi status valid dan tidak valid.
- [ ] Test harga: log semua unit, log blok, log terjadwal, adjustment unit. GR-A03 = 380 juta, GR-B01 = 460 juta pada 2026-11-10.
- [ ] Test availability: kuantitas, unit, dan penjumlahan lokasi induk.
- [ ] Halaman `/inventory/units`, price log, dan `/availability`.
- [ ] Uji isolasi company dan jalankan verifikasi standar.

---

## Yang harus dijalankan saat deploy

Backend menerapkan `prisma migrate deploy` saat start. Setelah Fase 1 ter-deploy, semua pengguna harus login ulang. Karena Fase 2 menghapus tabel, cek isi tabel dan buat backup sebelum Fase 2 di-deploy.
