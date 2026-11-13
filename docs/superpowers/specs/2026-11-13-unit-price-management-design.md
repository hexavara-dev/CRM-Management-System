# Desain Unit Price Management

- **Tanggal:** 2026-11-13
- **Status:** Disepakati, siap diimplementasikan
- **Jira:** CRM-14 Unit Price Management, dengan subtask CRM-51 Unit Price List, CRM-52 Unit Price Adjustment, dan CRM-53 Unit Price History
- **Sumber:** kartu Jira, `backend/prisma/schema.prisma` di `main`, dan [desain Product Management](2026-11-07-product-management-design.md)

## Latar belakang

Unit, varian, dan price log sudah ada di database, tetapi belum ada cara melihat harga jual setiap unit atau mengubahnya dengan aman.

Kondisi di `main`:

| Bagian | Sudah ada | Belum ada |
| --- | --- | --- |
| `product_units` | Kode, varian, blok (`category_id`), status, `adjustment_amount`, `adjustment_reason` | Tanggal efektif dan riwayat penyesuaian. Nilai lama hilang saat diubah. |
| `product_variants` | `base_price`, `current_price` (BigInt) | Batas minimum harga jual |
| `product_variant_price_logs` | Kenaikan per varian, opsional per blok, dengan periode | Endpoint dan perhitungan |
| Approval | Tidak ada | Status pengajuan dan penyetuju |
| Frontend | Menu "Pricing" ke `/pricing` | Halamannya |

Dalam istilah aplikasi saat ini, **project** adalah `products`, **tipe rumah** adalah `product_variants`, dan **lokasi** unit adalah kategori tempat unit berada, biasanya `BLOCK`.

## Tujuan

1. **CRM-51:** daftar unit beserta harga dasar, harga jual aktif, dan rinciannya, dengan filter project, lokasi, tipe, dan status.
2. **CRM-52:** penyesuaian harga per unit dengan nominal, alasan wajib, dan tanggal efektif. Hasil di bawah batas minimum membutuhkan approval.
3. **CRM-53:** riwayat perubahan harga per unit yang tidak bisa diubah, mencatat harga sebelum dan sesudah, tanggal efektif, alasan, pengaju, dan approver.

## Di luar cakupan

- Membuat dan mengelola price log per varian atau blok. Log tetap ikut dihitung dan ditampilkan, dan datanya diisi lewat seeder lokal.
- Membuat dan mengubah unit. Unit untuk pengujian diisi lewat seeder lokal.
- Hak akses per role. Saat ini hanya `owner` yang bisa menulis. Hak akses dirapikan bersama fitur lain.
- Notifikasi pengajuan approval.
- Menghapus `product_variants.current_price`. Kolom dibiarkan dan dibahas dengan tim.

## Keputusan desain

| No | Keputusan | Alasan |
| --- | --- | --- |
| 1 | Harga jual dihitung saat dibaca, tidak disimpan | Selalu sesuai periode berlaku tanpa job terjadwal |
| 2 | Batas minimum di kolom baru `product_variants.min_price`, nullable | Setiap tipe bisa punya batas berbeda. Null berarti tanpa batas. |
| 3 | Penyesuaian per unit disimpan di tabel baru `unit_price_adjustments` | Satu tabel melayani penyesuaian, approval, dan riwayat |
| 4 | `product_units.adjustment_amount` dan `adjustment_reason` tidak dipakai lagi | Nilai yang berlaku diambil dari riwayat. Kolom dihapus setelah disepakati tim. |
| 5 | Penyesuaian menyimpan nominal selisih, bukan harga akhir | Kenaikan varian atau blok berikutnya tetap berlaku pada unit yang sudah disesuaikan |
| 6 | Riwayat hanya bisa ditambah | DoD CRM-53. Tidak ada endpoint ubah atau hapus. |
| 7 | Penyesuaian di bawah minimum masuk `PENDING`, walaupun diajukan `owner` | Alur approval sudah siap saat hak akses dirapikan |
| 8 | `current_price` tidak dipakai dalam perhitungan harga unit | Kolom ini disimpan dan tidak punya aturan pembaruan |
| 9 | Harga memakai BigInt dalam rupiah, mengikuti kolom harga yang ada | Konsisten dengan `base_price` dan `adjustment_price` |

## Perhitungan harga

```
harga dasar = product_variants.base_price
kenaikan    = jumlah adjustment_price dari price log aktif milik varian unit,
              dengan category_id null (semua unit) atau sama dengan blok unit
              atau salah satu induk blok unit
penyesuaian = amount dari unit_price_adjustments terbaru milik unit
              yang berstatus APPROVED dan sudah efektif
harga jual  = harga dasar + kenaikan + penyesuaian
```

- **Price log aktif:** `effective_start <= tanggal acuan` dan `end_date` kosong atau `>= tanggal acuan`. Kolom `status` pada price log diabaikan.
- **Penyesuaian aktif:** hanya satu yang berlaku per unit, yaitu baris `APPROVED` dengan `effective_date <= tanggal acuan` yang paling baru (urut `effective_date`, lalu `approved_at`). Penyesuaian baru menggantikan yang lama, bukan ditambahkan.
- **Tanggal acuan:** hari ini dalam zona waktu `Asia/Jakarta`, atau parameter `date` pada API.
- **Harga jual tidak boleh negatif.** Penyesuaian yang membuatnya negatif ditolak.

Contoh: Type 45 dengan harga dasar 450.000.000, kenaikan Blok B +20.000.000 yang sudah aktif, dan penyesuaian unit +10.000.000. Harga jual = 480.000.000.

## Model data

### Perubahan `product_variants`

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `min_price` | BIGINT, nullable | Tidak negatif. Null berarti tanpa batas minimum. |

### Tabel baru `unit_price_adjustments`

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `id` | VARCHAR(36) | UUID |
| `company_id` | VARCHAR(36) | Dari JWT |
| `unit_id` | VARCHAR(36) | Unit milik company yang sama |
| `amount` | BIGINT | Selisih terhadap harga dasar + kenaikan. Boleh negatif. |
| `price_before` | BIGINT | Harga jual pada `effective_date`, dihitung saat diajukan |
| `price_after` | BIGINT | `price_before` dikurangi penyesuaian lama, ditambah `amount` |
| `min_price` | BIGINT, nullable | Salinan batas minimum saat diajukan |
| `reason` | TEXT | Wajib, 3 sampai 500 karakter |
| `effective_date` | DATE | Hari ini atau setelahnya |
| `status` | ENUM | `PENDING`, `APPROVED`, `REJECTED` |
| `requested_by` | VARCHAR(36) | User pengaju, dari JWT |
| `approved_by` | VARCHAR(36), nullable | User yang menyetujui atau menolak |
| `approved_at` | DATETIME, nullable | |
| `review_note` | TEXT, nullable | Wajib saat ditolak |
| `created_at` | DATETIME | |

Index: `(company_id, unit_id, status, effective_date)` dan `(company_id, status)`.

`price_before` dan `price_after` disimpan karena riwayat harus menunjukkan angka pada saat perubahan, walaupun harga dasar atau price log berubah kemudian.

## Aturan bisnis

### Pengajuan penyesuaian

1. Unit harus milik company yang sama dan tidak berstatus `SOLD`.
2. `reason` wajib dan `effective_date` tidak boleh sebelum hari ini.
3. Hanya boleh ada satu pengajuan `PENDING` per unit. Pengajuan kedua ditolak dengan 409 sampai yang pertama diputuskan.
4. Sistem menghitung `price_before` dan `price_after` pada `effective_date`.
5. `price_after` harus lebih dari atau sama dengan 0.
6. Jika `min_price` varian terisi dan `price_after < min_price`, status menjadi `PENDING`. Selain itu langsung `APPROVED`, dengan `approved_by` sama dengan pengaju.
7. Semua langkah berjalan dalam satu transaksi database.

### Approval

- Hanya pengajuan `PENDING` yang bisa disetujui atau ditolak.
- Menyetujui mengisi `approved_by`, `approved_at`, dan status `APPROVED`. Jika `effective_date` sudah lewat, penyesuaian berlaku sejak disetujui.
- Menolak mewajibkan `review_note`.
- Perubahan status memakai update bersyarat (`status = PENDING`), sehingga dua keputusan bersamaan tidak saling menimpa.

### Hak akses sementara

| Aksi | Role |
| --- | --- |
| Melihat daftar harga, rincian, dan riwayat | Semua user yang login |
| Mengajukan, menyetujui, dan menolak penyesuaian | `owner` |

### Keamanan

- `company_id`, pengaju, dan approver selalu diambil dari JWT.
- Filter project, lokasi, tipe, dan unit divalidasi milik company yang sama.
- Respons tidak memuat data user selain `id` dan `name`.

## API

Semua endpoint berada di `/api`, membutuhkan autentikasi, dan mengikuti bentuk respons daftar yang ada: `{ data, meta: { total, page, limit, totalPages } }`.

| Method | Endpoint | Role | Keterangan |
| --- | --- | --- | --- |
| GET | `/unit-prices` | Semua | Daftar harga unit. Filter `productId`, `categoryId` (termasuk turunan), `variantId`, `status`, `search` (kode unit), `date`, `page`, `limit`. Juga mengembalikan `summary`. |
| GET | `/unit-prices/:unitId` | Semua | Rincian harga satu unit: harga dasar, daftar price log aktif, penyesuaian aktif, pengajuan `PENDING`, dan harga jual |
| GET | `/unit-prices/:unitId/history` | Semua | Riwayat penyesuaian unit, terbaru dulu, dengan paginasi |
| POST | `/unit-prices/:unitId/adjustments` | Owner | Body `{ amount, reason, effectiveDate }` |
| GET | `/unit-price-adjustments?status=PENDING` | Semua | Daftar pengajuan untuk approval |
| POST | `/unit-price-adjustments/:id/approve` | Owner | |
| POST | `/unit-price-adjustments/:id/reject` | Owner | Body `{ note }` |
| PUT | `/products/:id/variants/:variantId` | Owner | Endpoint yang ada, menerima `minPrice` |

Contoh satu baris `GET /unit-prices`:

```json
{
  "unitId": "uuid",
  "code": "GR-B01",
  "status": "AVAILABLE",
  "product": { "id": "uuid", "name": "Perumahan Green" },
  "variant": { "id": "uuid", "name": "Type 45", "minPrice": 440000000 },
  "location": { "id": "uuid", "name": "Block B", "type": "BLOCK" },
  "basePrice": 450000000,
  "priceLogTotal": 20000000,
  "adjustment": 10000000,
  "sellingPrice": 480000000,
  "hasPendingAdjustment": false
}
```

BigInt dikirim sebagai number, mengikuti serializer global di `backend/src/index.ts`. Nilai harga dibatasi `Number.MAX_SAFE_INTEGER` sehingga tetap presisi. `summary` berisi `totalUnits` (sesuai filter), `pendingAdjustments` (seluruh company), dan `date` (tanggal acuan).

## Frontend

Halaman `/pricing`, sesuai menu "Pricing" yang sudah ada. Struktur dan komponennya mengikuti halaman project:

- **Layout:** `SidebarProvider`, `AppSidebar`, `SidebarInset`, `SidebarOpenTrigger`, `PageHeading`, dan garis pemisah.
- **Ringkasan:** `StatCard` untuk total unit dan pengajuan menunggu approval. Rata-rata harga tidak ditampilkan karena harus menghitung semua unit, bukan satu halaman.
- **Filter:** project, lokasi, tipe, dan status memakai `Select` dari `components/ui`, ditambah pencarian kode unit memakai `Input` dengan `useDebouncedValue`.
- **Tabel:** komponen `Table` dari `components/ui` dengan kolom nomor unit, project, tipe, lokasi, status, harga dasar, harga jual, dan aksi. Paginasi mengikuti halaman project.
- **Rincian unit:** `Sheet` dari samping dengan rincian harga, form penyesuaian, dan riwayat. Form memakai React Hook Form, Zod, `FormInput`, dan `FormTextarea`. Tombol penyesuaian hanya tampil untuk `owner`.
- **Approval:** tab atau bagian "Menunggu approval" berisi pengajuan `PENDING`, dengan tombol setujui dan tolak untuk `owner`.
- **Data:** hook baru `hooks/use-unit-prices.ts` dengan TanStack Query. Query key memuat semua filter, dan setiap mutasi meng-invalidate daftar, rincian, riwayat, dan pengajuan.
- **Kondisi:** loading memakai `Skeleton`, kosong memakai `Empty`, error memakai pesan dari API, dan sukses memakai toast `sonner`.

## Data pengujian lokal

Seeder lokal mengisi data agar halaman bisa dicoba: dua project, tiga tipe dengan `min_price`, dua blok, tujuh unit dengan berbagai status, satu price log untuk semua unit yang sudah aktif, dan satu price log Blok B yang dijadwalkan.

**Seeder ini hanya untuk lokal dan tidak di-commit.** Seeder bersifat idempoten, menolak berjalan saat `NODE_ENV=production`, dan hanya menyentuh data dengan kode berawalan `DEMO-`.

## Pengujian

- Perhitungan harga: tanpa log, log semua unit, log per blok, log di induk blok, log terjadwal, log kedaluwarsa, dan penyesuaian yang menggantikan penyesuaian lama.
- Pengajuan: alasan kosong ditolak, tanggal lampau ditolak, unit `SOLD` ditolak, harga negatif ditolak, dan pengajuan kedua saat ada `PENDING` ditolak.
- Batas minimum: di atas minimum langsung `APPROVED`, di bawah minimum `PENDING`, dan tanpa `min_price` selalu `APPROVED`.
- Approval: hanya `PENDING` yang bisa diputuskan, penolakan wajib catatan, dan keputusan ganda hanya berhasil sekali.
- Riwayat: tidak ada endpoint ubah atau hapus, dan harga sebelum dan sesudah tetap walaupun harga dasar berubah.
- Isolasi company dan penolakan `member` pada endpoint tulis.
- Frontend: `npx tsc --noEmit`, `npm run build`, dan smoke test halaman `/pricing` dengan data seeder.

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Daftar harga lambat karena dihitung untuk setiap unit | Ambil price log dan penyesuaian aktif untuk satu halaman sekaligus, bukan per unit |
| Tim lain masih menulis `adjustment_amount` | Kolom tidak dipakai perhitungan. Dibahas sebelum dihapus. |
| Hak akses berubah saat dirapikan | Pemeriksaan role dipusatkan di route, sehingga mudah diganti |
| Zona waktu membuat tanggal efektif bergeser | Tanggal acuan memakai `Asia/Jakarta` dan kolom bertipe `DATE` |
