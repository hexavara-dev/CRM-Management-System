# Konfigurasi Form Template — Design

Tanggal: 2026-11-20
Menu: CRM Configuration → Konfigurasi Form Template (`/crm-configuration/form-template`)

## Tujuan

Setiap company membuat template form Lead berisi custom field sesuai kebutuhan bisnis (mis. properti, kendaraan, korporat). Field standar (Nama, Nomor HP, Email) selalu tersedia di setiap form. Satu template ditandai **Default** dan dipakai otomatis saat menambah Lead.

Task ini hanya **konfigurasi**. Memakai template di form Add Lead dan menyimpan jawabannya dikerjakan di task berikutnya; skemanya disiapkan di sini.

## Kondisi saat ini

- Belum ada custom field. Form Lead memakai kolom tetap di `customer` (nama, no. HP, email, gender, sapaan, lokasi) dan `lead`.
- Belum ada tempat menyimpan jawaban field tambahan pada Lead.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Form default | (a) Field standar Nama, Nomor HP, Email selalu ada dan terkunci di setiap template. (b) Satu template **Default** per company, dipakai otomatis saat Add Lead. |
| 2 | Editor | Halaman tersendiri (builder + preview langsung), bukan modal. |
| 3 | Tipe field | `TEXT`, `TEXTAREA`, `NUMBER`, `CURRENCY`, `DATE`, `SELECT`, `MULTISELECT`, `BOOLEAN`, `PHONE`, `EMAIL`. Upload file dan pilihan data (project/unit) belum. |
| 4 | Snapshot | Template berversi. Versi yang sudah dipakai Lead tidak pernah diubah; mengedit template tersebut membuat versi baru. Lead lama tetap menunjuk versi lamanya. |
| 5 | Cakupan | Konfigurasi: daftar, tambah/edit (builder), preview, duplikat, hapus, status, default. |
| 6 | Penyimpanan field | Bukan kolom database per field. Definisi field disimpan sebagai JSON pada versi template; jawaban Lead nanti disimpan sebagai JSON berdasarkan `key` field. |
| 7 | Data awal | Tanpa data default di aplikasi; data contoh hanya di database lokal. |
| 8 | Multi-tenant | `company_id` dari JWT; semua operasi di-scope ke company; template company lain → 404. |
| 9 | Hak akses | Membaca: semua user login. Mengubah: owner. |

## Database

Migrasi `add_lead_form_templates`:

```
lead_form_templates
  id, company_id
  name VARCHAR(150), description VARCHAR(500) NULL
  icon VARCHAR(50), color VARCHAR(7)
  is_default BOOLEAN, is_active BOOLEAN
  default_guard VARCHAR(10) NULL      -- 'default' bila default; UNIQUE(company_id, default_guard)
  current_version_id VARCHAR(36) NULL
  updated_by_id VARCHAR(36) NULL → users (SET NULL)
  created_at, updated_at
  UNIQUE(company_id, name)

lead_form_template_versions
  id, company_id, template_id → lead_form_templates (CASCADE)
  version INT                          -- 1, 2, 3, ...
  fields JSON                          -- definisi field versi ini
  is_locked BOOLEAN DEFAULT false      -- true setelah dipakai Lead; tidak bisa diubah lagi
  created_by_id VARCHAR(36) NULL → users (SET NULL)
  created_at
  UNIQUE(template_id, version)
```

Disiapkan untuk task berikutnya (tidak dibuat di task ini):
```
lead.form_template_version_id  → lead_form_template_versions
lead.custom_values             JSON   -- { "<key>": <nilai>, ... }
```
Saat Lead pertama memakai sebuah versi, versi itu ditandai `is_locked = true`.

### Definisi field (isi `fields`)

```json
[
  {
    "key": "rencana_pembayaran",
    "label": "Rencana Pembayaran",
    "type": "SELECT",
    "required": true,
    "placeholder": "Pilih rencana pembayaran",
    "helpText": null,
    "options": ["Tunai", "KPR", "KPR Syariah"]
  }
]
```

- `key`: dibuat otomatis dari label (huruf kecil, `_`), unik dalam satu versi, dipertahankan antar-versi untuk field yang sama. Kunci field standar (`name`, `phone`, `email`) dicadangkan.
- `options`: wajib untuk `SELECT`/`MULTISELECT` (1–50 opsi, masing-masing 1–100 karakter, unik); tidak dipakai tipe lain.
- Urutan array = urutan tampil.

## Aturan versi

- Membuat template → versi 1, `current_version_id` menunjuk versi 1.
- Mengedit field:
  - Versi saat ini belum terkunci → versi itu diperbarui langsung.
  - Versi saat ini terkunci → dibuat versi baru (nomor berikutnya) dan `current_version_id` dipindahkan.
- Mengubah nama/deskripsi/ikon/warna/status tidak membuat versi baru.
- Semua penyimpanan dalam satu transaksi.

## Aturan lain

- **Default**: hanya satu per company; menjadikan template lain default memindahkan tanda. Template default harus aktif; tidak bisa dinonaktifkan atau dihapus; tidak bisa dilepas langsung (pilih template lain).
- **Hapus**: ditolak bila template default atau bila ada versi yang terkunci (sudah dipakai Lead); sarankan menonaktifkan.
- **Duplikat**: menyalin nama (+ " (Salinan)", dinomori bila bentrok), deskripsi, ikon, warna, dan field versi saat ini menjadi template baru versi 1; tidak default, aktif.
- Nama template unik per company (tanpa membedakan huruf besar/kecil).

## API

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/lead-form-templates?search=&status=active\|inactive&page=&limit=` | Login | `{ data, meta }`; tiap item: info template, `fieldCount`, `version`, `updatedAt`, `updatedBy { id, name }` |
| GET | `/api/lead-form-templates/:id` | Login | Template + `fields` versi saat ini + `version`, `versionLocked` |
| POST | `/api/lead-form-templates` | Owner | `{ name, description?, icon, color, isActive?, isDefault?, fields }` |
| PUT | `/api/lead-form-templates/:id` | Owner | Field yang sama (parsial); `fields` bila dikirim mengikuti aturan versi |
| POST | `/api/lead-form-templates/:id/duplicate` | Owner | Template baru hasil salinan |
| DELETE | `/api/lead-form-templates/:id` | Owner | 204; 409 bila default atau sudah dipakai |

Validasi:
- `name` 1–150, `description` maks. 500, `color` `#RRGGBB`, `icon` dari daftar ikon.
- `fields` maks. 50; `label` 1–100; `type` dari daftar; `placeholder` dan `helpText` maks. 200; aturan `options` di atas; label unik dalam satu template (tanpa membedakan huruf besar/kecil).
- Klien boleh mengirim `key` untuk mempertahankan field lama; bila kosong, dibuat dari label. Kunci dicadangkan ditolak.
- Field lain (termasuk `tenantId`, `version`) ditolak.

Layer: `LeadFormTemplateController` → `LeadFormTemplateUseCase` → Prisma.

## Ikon

Memakai daftar ikon label Lead (frontend dan backend), ditambah `megaphone` dan `user-plus` untuk contoh di mockup (`car` sudah ada).

## Frontend

**Daftar** (`/crm-configuration/form-template`), mengikuti mockup:
- `ConfigHeader` (ikon dokumen), kotak info Form Template.
- Pencarian, filter status, tombol **Tambah Template** (owner).
- Tabel: ikon berwarna + nama + badge Default, Deskripsi, Jumlah Field, Terakhir Diubah (tanggal + "oleh …"), Status, Actions (Preview, Edit, Duplikat, Hapus).
- Pagination dengan baris per halaman.

**Editor** (`/crm-configuration/form-template/new` dan `/crm-configuration/form-template/[id]`):
- Kiri: informasi template (nama, deskripsi, ikon, warna, Active, Default) dan daftar field:
  - Field standar Nama, Nomor HP, Email ditampilkan terkunci di atas.
  - Custom field: tambah, edit (label, tipe, wajib, placeholder, teks bantuan, opsi), hapus, geser urutan (dnd-kit).
- Kanan: preview form langsung seperti yang dilihat sales saat Add Lead.
- Info versi: "Versi N"; bila versi terkunci, keterangan bahwa menyimpan perubahan field akan membuat versi baru.
- Tombol Simpan dan Batal; peringatan saat meninggalkan halaman dengan perubahan belum disimpan.

**Preview** (dari daftar): modal yang menampilkan form (field standar + custom field) dalam keadaan tidak dapat diisi.

Loading, kosong, error ditangani; non-owner hanya melihat; responsif.

## Test

- Use case: list di-scope tenant dengan jumlah field dan pengubah terakhir; create membuat versi 1; edit field pada versi tidak terkunci memperbarui versi yang sama; pada versi terkunci membuat versi baru; ubah info tanpa field tidak membuat versi; default pindah dan dilindungi; hapus ditolak bila default/terkunci; duplikat menyalin field dan menamai salinan; tenant lain 404; nama duplikat 409.
- Validasi: tipe field, opsi untuk pilihan, kunci dicadangkan/duplikat, batas jumlah, label unik, field tidak dikenal.

## Di luar cakupan

- Memakai template di form Add Lead, menyimpan `custom_values`, dan mengunci versi saat dipakai.
- Tipe field upload file dan pilihan data (project/unit).
- Riwayat versi (melihat versi lama) di UI.
