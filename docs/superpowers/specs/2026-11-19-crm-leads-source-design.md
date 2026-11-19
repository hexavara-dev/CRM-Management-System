# Konfigurasi Leads Source — Design

Tanggal: 2026-11-19
Menu: CRM Configuration → Konfigurasi Leads Source (`/crm-configuration/leads-source`)

## Tujuan

Setiap company mengelola sumber Leads (mis. Website, Meta Ads, Referral, Walk In) untuk mengidentifikasi dari mana prospek diperoleh.

## Kondisi saat ini

- Tabel `source` sudah ada: `name` (VARCHAR 50), `color`, `type` (`lead` | `viewing`), `created_at`, `company_id`.
- Dipakai oleh `lead.source_id` (tipe `lead`) dan `viewing.source_id` (tipe `viewing`).
- Dikelola di Settings → tab "Lead Sources" dan "Visit Sources" lewat CRUD generik `/api/source` (tambah/hapus, tanpa edit, tanpa cek pemakaian saat hapus).

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Penyimpanan | Memakai tabel `source` yang ada (tipe `lead`), ditambah `description` dan `is_active`. |
| 2 | Settings | Tab "Lead Sources" dihapus dari Settings. Tab "Visit Sources" tetap. |
| 3 | Cakupan | Hanya halaman dan API konfigurasi. Penyaringan source nonaktif di form Lead dikerjakan nanti. |
| 4 | Data awal | Tidak ada data default. Source yang sudah ada tetap dipakai dan berstatus Aktif. |
| 5 | Endpoint lama | `/api/source` (generik) tidak dipakai halaman baru. Untuk sementara tetap ada karena masih dipakai form Lead (daftar pilihan) dan Visit Sources; dihapus setelah keduanya pindah. |
| 6 | Hapus | Source yang sudah dipakai Lead tidak boleh dihapus (409, sarankan menonaktifkan). |
| 7 | Multi-tenant | `company_id` dari JWT; semua operasi di-scope ke company; source company lain → 404. |
| 8 | Hak akses | Membaca: semua user login. Menambah/mengubah/menghapus: owner. |

## Database

Migrasi `extend_lead_sources` (hanya menambah/memperlebar):

```sql
ALTER TABLE `source`
  MODIFY `name` VARCHAR(255) NOT NULL,
  ADD COLUMN `description` VARCHAR(500) NULL,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
```

## API

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/lead-sources?search=&status=active\|inactive&page=&limit=` | Login | `{ data, meta }`, hanya tipe `lead`, urut `created_at` |
| POST | `/api/lead-sources` | Owner | `{ name, description?, color, isActive? }` |
| PUT | `/api/lead-sources/:id` | Owner | Field yang sama (parsial) |
| DELETE | `/api/lead-sources/:id` | Owner | 204; 409 bila dipakai Lead |

Validasi:
- `name` 1–255 karakter, unik per company untuk tipe `lead` (409, tanpa membedakan huruf besar/kecil).
- `color` format `#RRGGBB` (disimpan huruf besar).
- `description` maks. 500 karakter.
- Field lain (termasuk `type`, `tenantId`) ditolak.

Layer: `LeadSourceController` → `LeadSourceUseCase` → Prisma.

## Frontend

Halaman `/crm-configuration/leads-source`, mengikuti mockup:
- Judul dan deskripsi halaman, breadcrumb dari menu.
- Pencarian nama, filter status (Semua/Aktif/Nonaktif), tombol **Tambah Leads Source** (owner).
- Tabel: No, Nama Leads Source, Deskripsi, Warna (kotak + hex), Status (Aktif/Nonaktif), Tanggal Dibuat ("10 Nov 2026, 09:14"), Aksi (edit, hapus; owner).
- Modal tambah/edit: nama, deskripsi, warna (color picker + hex), Aktif.
- Hapus dengan konfirmasi; pesan 409 ditampilkan apa adanya.
- Pagination "Menampilkan x – y dari n data".
- Loading, kosong, error; non-owner hanya melihat; tabel dapat di-scroll horizontal.
- Settings: tab "Lead Sources" dihapus.

## Test

- Use case: list di-scope tenant + tipe `lead` dengan search/status/paginasi; create/update; nama duplikat 409; source tenant lain atau tipe `viewing` → 404; hapus ditolak bila dipakai Lead.
- Validasi: warna, panjang field, field tidak dikenal, filter status.

## Di luar cakupan

- Menyembunyikan source nonaktif di form Lead.
- Memindahkan Visit Sources dan menghapus `/api/source`.
