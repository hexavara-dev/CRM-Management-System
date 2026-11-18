# Konfigurasi Leads Label — Design

Tanggal: 2026-11-18
Menu: CRM Configuration → Konfigurasi Leads Label (`/crm-configuration/leads-label`)

## Tujuan

Setiap company mengelola label untuk mengklasifikasikan Lead:
- **Temperature**: tingkat ketertarikan Lead (Hot, Warm, Cold). Satu Lead hanya memiliki satu Temperature aktif.
- **Tags**: label tambahan untuk karakteristik/kebutuhan Lead. Satu Lead dapat memiliki lebih dari satu Tag.

Task ini hanya **konfigurasi**. Memasang label ke Lead dikerjakan di task berikutnya.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Cakupan | Halaman dan API konfigurasi label. Belum ada relasi ke Lead. |
| 2 | Wajib Diisi | Per label Temperature (`is_required`): bila Temperature ini dipilih pada Lead, sales wajib mengisi alasan. Disimpan sekarang; efeknya berlaku saat label dipasang ke Lead. Arti dikonfirmasi ke client. Tags tidak memiliki Wajib Diisi. |
| 3 | Hapus | Label yang sudah dipakai Lead tidak boleh dihapus (409, sarankan menonaktifkan). Selama relasi ke Lead belum ada, hapus selalu diizinkan; pengecekan ditambahkan bersama relasinya. |
| 4 | Data awal | Tidak ada label default. Setiap company membuat labelnya sendiri. |
| 5 | Multi-tenant | Setiap label milik satu company (`company_id`), diambil dari JWT. Semua operasi di-scope ke company; label company lain → 404. |
| 6 | Hak akses | Membaca: semua user login. Menambah/mengubah/menghapus: owner. |

## Database

Migrasi `add_lead_labels`:

```sql
CREATE TABLE `lead_labels` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `type` ENUM('TEMPERATURE', 'TAG') NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(7) NOT NULL,
  `icon` VARCHAR(50) NOT NULL,
  `description` VARCHAR(500) NULL,
  `is_required` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL,
  UNIQUE INDEX `lead_labels_company_id_type_name_key` (`company_id`, `type`, `name`),
  INDEX `lead_labels_company_id_type_sort_order_idx` (`company_id`, `type`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `lead_labels_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
```

Tidak ada data awal: setiap company mulai tanpa label dan membuatnya sendiri.

## Ikon

Daftar ikon tetap (kunci → ikon lucide) yang sama di backend (validasi) dan frontend (render dan picker), mis. `flame`, `snowflake`, `thermometer`, `coins`, `layers`, `clock`, `briefcase`, `users`, `landmark`, `tag`, `star`, `heart`, `home`, `wallet`, `calendar`, `phone`, `alert`, `check`, `x`, `info`.

## API

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/lead-labels?type=TEMPERATURE\|TAG&page&limit` | Login | `{ data, meta, counts: { TEMPERATURE, TAG } }`, urut `sort_order`, lalu nama |
| POST | `/api/lead-labels` | Owner | `{ type, name, color, icon, description?, isRequired?, isActive? }` |
| PUT | `/api/lead-labels/:id` | Owner | Field yang sama kecuali `type` (tidak bisa diubah) |
| DELETE | `/api/lead-labels/:id` | Owner | 204; 409 bila sudah dipakai Lead (setelah relasi ada) |

Validasi:
- `name` 1–100 karakter, unik per company + tipe (409).
- `color` format `#RRGGBB`.
- `icon` harus ada di daftar ikon.
- `description` maks. 500 karakter.
- `isRequired` hanya untuk `TEMPERATURE`; untuk `TAG` ditolak (400).
- Field lain (termasuk `tenantId`/`companyId`) ditolak.

Layer: `LeadLabelController` (tipis) → `LeadLabelUseCase` (aturan, scope tenant) → Prisma.

## Frontend

Halaman `/crm-configuration/leads-label`, mengikuti mockup:
- Judul, ikon, dan deskripsi halaman; breadcrumb "CRM Configuration › Konfigurasi Leads Label".
- Tab **Temperature (n)** dan **Tags (n)**, tombol **Add Label** (owner).
- Kotak info sesuai tab.
- Tabel: Label (badge berwarna), Warna (kotak + hex), Ikon, Deskripsi, Wajib Diisi (khusus Temperature, dengan tooltip), Status (Active/Inactive), Actions (edit, hapus; owner).
- Toggle Wajib Diisi langsung menyimpan (owner).
- Modal Add/Edit: nama, warna (color input + hex), ikon (grid pilihan), deskripsi, Active, Wajib Diisi (Temperature).
- Hapus dengan konfirmasi.
- Pagination dengan "Baris per halaman" (10/20/50) dan "Menampilkan x–y dari n label".
- Loading, kosong, dan error ditangani. Non-owner hanya melihat.
- Responsive: tabel dapat di-scroll horizontal di layar kecil.

## Test

- Use case: list di-scope tenant dengan counts; create/update/delete; nama duplikat 409; label tenant lain 404; `isRequired` pada TAG ditolak.
- Validasi: warna, ikon, panjang field, field tidak dikenal.

## Di luar cakupan

- Memasang Temperature/Tags ke Lead dan form alasan Wajib Diisi.
- Pengecekan "sudah dipakai" saat hapus (ditambahkan bersama relasi ke Lead).
- Mengubah urutan label (drag & drop).
