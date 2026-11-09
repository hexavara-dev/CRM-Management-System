# Rencana Implementasi Product & Availability Management (P1)

**Tujuan:** Membangun P1 sesuai [dokumen desain](../specs/2026-11-07-product-management-design.md), setelah `Tenant` diganti menjadi `Company`.

**Arsitektur:** Express dengan alur `presentation -> usecases -> infrastructure -> Prisma/MySQL`, serta Next.js dengan TanStack Query. Aturan stok dan harga berada di use case khusus, bukan CRUD generik. Tidak boleh ada kode, kolom, atau label yang khusus untuk satu industri.

**Stack:** Prisma 7, MySQL 8.0, Jest, Next.js 16, React Hook Form, Zod.

## Sebelum mulai

- [x] Keputusan P1 pada dokumen desain sudah disepakati.
- [ ] Pembuat dokumen `Universal_Product_Master` sudah diberi tahu perbedaan desainnya.
- [ ] Jumlah baris tabel lama sudah dicek di setiap environment dengan query di bawah. Jika ada isinya, putuskan dulu nasib datanya.
- [ ] Backup database server dev tersedia sebelum migrasi diterapkan.

Query pengecekan tabel lama di server Docker. Semua hasil harus `0` sebelum Fase 2 di-deploy:

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

Verifikasi standar yang disebut di bawah:

```bash
cd backend && npm run lint && npm run build && npm test -- --runInBand
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

---

## Fase 1: `Tenant` menjadi `Company` (PR 1)

Tidak ada perubahan fitur pada fase ini.

### Task 1.1: Schema dan migrasi

**File:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/<timestamp>_rename_tenant_to_company/migration.sql`

- [ ] Ganti model `Tenant` menjadi `Company` dan `tenantId` menjadi `companyId` di semua model.
- [ ] Buat migrasi dengan `npx prisma migrate dev --create-only`.
- [ ] Tinjau SQL-nya. Ganti setiap drop dan create dengan `RENAME TABLE`, `RENAME COLUMN`, dan penggantian nama constraint.
- [ ] Terapkan pada salinan database yang berisi data, lalu pastikan jumlah baris semua tabel sama.
- [ ] Pastikan `npx prisma migrate diff` tidak menemukan perbedaan antara schema dan database.

### Task 1.2: Backend

**File:** seluruh `backend/src`, `backend/tests`, `backend/prisma/seed.ts`

- [ ] Ganti `tenantId` menjadi `companyId`, termasuk klaim JWT di `AuthUseCases` dan pengecekan di `AuthMiddleware`.
- [ ] Ganti `tenantName` menjadi `companyName` pada onboarding, beserta validasinya.
- [ ] Pastikan token lama ditolak dengan 401, bukan error 500. Tambahkan test untuk kasus ini.
- [ ] Jalankan verifikasi backend.

### Task 1.3: Frontend

**File:** `frontend/app`, `hooks`, `components`, `types`, `schemas`, `lib`

- [ ] Ganti `tenantId` dan `tenantName`, termasuk `registerSchema` dan form `/register`.
- [ ] Jalankan verifikasi frontend.

### Task 1.4: Dokumentasi dan smoke test

**File:** `AGENTS.md`, `README.md`, `docs/`

- [ ] Perbarui istilah di `AGENTS.md` bagian 4 dan 5, serta docs lain.
- [ ] Smoke test browser: register, login, lead, deal, kunjungan.
- [ ] Pastikan `grep -ri tenant backend/src backend/tests frontend/app frontend/hooks` kosong.

---

## Fase 2: Master data dan katalog (PR 2)

### Task 2.1: Hapus tabel lama

**File:** `schema.prisma`, `backend/src/index.ts`, `usecases/GenericUseCases.ts`, `usecases/viewing/ViewingUseCase.ts`, `presentation/dtos/ViewingDTO.ts`, `presentation/validation/CrmRequestValidation.ts`, `frontend/types/viewing.ts`, test terkait

- [ ] Hapus model yang tercantum pada keputusan 2 dan relasinya.
- [ ] Hapus `slotId` dari Viewing beserta validasi dan tipenya.
- [ ] Hapus model tersebut dari daftar route generik dan aturan `GenericUseCases`.
- [ ] Pastikan route lama membalas 404.
- [ ] Jalankan verifikasi standar, dan uji flow kunjungan.

### Task 2.2: Schema master dan katalog

**File:** `schema.prisma`, migrasi baru

- [ ] Tambahkan `product_categories`, `units_of_measure`, `product_attributes`, `characteristic_groups`, `characteristics`, `products`, `product_variants`, dan `product_attribute_values`.
- [ ] Tambahkan `parent_id` dan `type` pada `location`, serta `address` pada `company`.
- [ ] Tambahkan unique index per company dan index untuk foreign key.
- [ ] Pastikan migrasi berjalan pada database kosong dan salinan database dev.

### Task 2.3: API master data

**File:** `backend/src/usecases/product/`, `presentation/controllers/`, `presentation/validation/`, `tests/`

Tulis test lebih dulu pada setiap langkah.

- [ ] Test: kategori dengan parent milik company lain ditolak, siklus parent ditolak, dan level keenam ditolak.
- [ ] Test: filter kategori menyertakan seluruh turunannya.
- [ ] Test: nilai atribut divalidasi sesuai `data_type`.
- [ ] Test: master yang sudah dipakai hanya bisa dinonaktifkan.
- [ ] Test: `member` tidak bisa menulis.
- [ ] Implementasikan CRUD setiap resource, dengan `companyId` dari JWT.
- [ ] Jalankan verifikasi backend.

### Task 2.4: API produk dan varian

- [ ] Test: produk baru tanpa varian otomatis mendapat varian `Default`, dalam satu transaksi.
- [ ] Test: `QUANTITY` wajib punya satuan.
- [ ] Test: varian dan atribut lintas produk atau lintas company ditolak.
- [ ] Test: satu atribut paling banyak punya satu nilai di tingkat produk dan satu di setiap varian.
- [ ] Implementasikan use case dan route, termasuk penguncian `tracking_type` yang dilengkapi pengecekan saldo dan unit pada Fase 3.
- [ ] Jalankan verifikasi backend.

### Task 2.5: Hierarki lokasi

**File:** use case atau route `location`, `frontend/hooks/use-locations.ts`, `frontend/types/location.ts`

- [ ] Test: parent lintas company dan siklus ditolak, serta lokasi lama tanpa parent tetap valid.
- [ ] Perbarui API dan tipe frontend dengan tetap menjaga bentuk respons yang dipakai Lead dan Viewing.
- [ ] Jalankan flow lead dan kunjungan untuk memastikan tidak ada regresi.

### Task 2.6: Layar master dan produk

**File:** `frontend/app/products/`, `frontend/app/settings/components/`, `frontend/hooks/`, `frontend/schemas/`, `frontend/constants/navigation-menu.tsx`, `frontend/components/Sidebar.tsx`

- [ ] Buat hook dan schema Zod untuk setiap resource, dengan query key yang memuat parameter dan invalidasi list serta detail.
- [ ] Buat layar master data dan halaman `/products`, `/products/[id]`.
- [ ] Sembunyikan aksi tulis dari `member`, dan pastikan API tetap menolaknya.
- [ ] Jalankan verifikasi frontend, lalu smoke test: buat produk kuantitas dan produk unit.

---

## Fase 3: Inventory (PR 3)

### Task 3.1: Inventory kuantitas

**File:** `schema.prisma`, migrasi baru, `backend/src/usecases/inventory/`, `tests/`

- [ ] Tambahkan `inventory_balances` dan `inventory_transactions`.
- [ ] Test: stock in, stock out, adjustment, dan opname mencatat transaksi dengan nilai sebelum dan sesudah.
- [ ] Test: stock out dan transfer melebihi availability ditolak.
- [ ] Test: transfer atomik dan kedua barisnya punya `transfer_ref` yang sama.
- [ ] Test: alasan wajib untuk adjustment dan opname.
- [ ] Test: saldo di lokasi yang punya turunan ditolak, dan lokasi bersaldo tidak bisa diberi turunan.
- [ ] Test: produk selain `QUANTITY` ditolak.
- [ ] Test integrasi dengan MySQL: dua stock out bersamaan pada stok terakhir, dan hanya satu yang berhasil.
- [ ] Implementasikan `InventoryUseCases` sebagai satu-satunya jalur perubahan saldo.
- [ ] Buat halaman `/inventory/quantity`.

### Task 3.2: Inventory unit

- [ ] Tambahkan `product_units`, `unit_characteristics`, `unit_attribute_values`, dan `unit_status_history`.
- [ ] Test: unit hanya untuk produk `UNIT`, dan `unit_code` unik per company.
- [ ] Test: registrasi massal gagal seluruhnya jika ada kode yang bentrok.
- [ ] Test: semua transisi status pada dokumen desain, valid dan tidak valid, serta riwayat tercatat.
- [ ] Test: unit `SOLD` tidak bisa dipindah atau dihapus.
- [ ] Test: karakteristik dan lokasi lintas company ditolak.
- [ ] Test: nilai atribut unit diambil dari unit, lalu varian, lalu produk, beserta asal nilainya.
- [ ] Implementasikan API dan halaman `/inventory/units`.

### Task 3.3: Penguncian dan availability

- [ ] Test: `tracking_type` terkunci setelah produk punya saldo, transaksi, atau unit.
- [ ] Test: availability kuantitas, availability unit, dan penjumlahan pada lokasi induk.
- [ ] Implementasikan `GET /availability` dan halaman `/availability`.
- [ ] Jalankan verifikasi standar.

---

## Fase 4: Harga, media, dan validasi akhir (PR 4)

### Task 4.1: Harga

- [ ] Tambahkan `product_prices` dan `unit_price_adjustments`.
- [ ] Test: overlap periode ditolak, harga negatif ditolak, dan `end_date` sebelum `effective_date` ditolak.
- [ ] Test pemilihan harga: lokasi sendiri, naik ke induk, default varian, tanggal di luar periode, dan tidak ada harga.
- [ ] Test harga akhir unit: 350 juta + 25 juta = 375 juta, serta hasil negatif ditolak.
- [ ] Implementasikan `PriceResolver` dan `GET /product-prices/resolve`.
- [ ] Buat halaman `/pricing`.

### Task 4.2: Media

**File:** `schema.prisma`, migrasi baru, `backend/src/usecases/product/`, `presentation/controllers/UploadController.ts`, `frontend/app/products/[id]/`, `frontend/hooks/`

- [ ] Tambahkan `product_media`.
- [ ] Test: hanya satu media utama per produk, varian, atau unit, dan penggantiannya terjadi dalam satu transaksi.
- [ ] Test: tipe file selain JPEG, PNG, WebP, dan PDF ditolak, dan `VIDEO_LINK` non-`https` ditolak.
- [ ] Test: varian atau unit yang bukan milik produk ditolak, dan media company lain tidak bisa dibuka.
- [ ] Test: menghapus media juga menghapus filenya.
- [ ] Implementasikan dengan memakai ulang penyimpanan `uploads` dan middleware akses yang sudah ada.
- [ ] Tambahkan galeri pada detail produk dan detail unit.

### Task 4.3: Validasi skenario dan penyelesaian

- [ ] Siapkan data sesuai bagian "Contoh data" di dokumen desain.
- [ ] Smoke test skenario trading sampai saldo dan availability cocok.
- [ ] Smoke test skenario properti: harga berbeda per proyek, penyesuaian unit hook, luas tanah GR-A03 100 m² dari nilai unit, dan GR-A01 72 m² dari nilai varian.
- [ ] Pastikan kedua skenario berjalan tanpa kode khusus, dan tidak ada label khusus satu industri di UI.
- [ ] Uji isolasi: akun company lain tidak bisa membaca atau memakai ID apa pun di atas.
- [ ] Perbarui `README.md` dan `docs/`.
- [ ] Jalankan verifikasi standar untuk kedua sisi.

---

## Yang harus dijalankan saat deploy

Backend menerapkan `prisma migrate deploy` saat start. Setelah Fase 1 ter-deploy, semua pengguna harus login ulang. Karena Fase 2 menghapus tabel, cek isi tabel dan buat backup sebelum Fase 2 di-deploy.
