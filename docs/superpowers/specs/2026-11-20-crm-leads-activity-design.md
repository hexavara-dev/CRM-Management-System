# Konfigurasi Leads Activity — Design

Tanggal: 2026-11-20 · Branch: `feat/crm-leads-activity-config`

## Tujuan
Setiap company dapat mengatur jenis aktivitas yang dipakai Sales saat mencatat interaksi dengan Lead (Follow Up, Penawaran, Visit, dst.). Khusus Leads.

## Lingkup tahap ini
- Halaman **CRM Configuration → Leads Activity Management** (`/crm-configuration/leads-activity`).
- CRUD jenis aktivitas per company (backend + frontend).

Di luar lingkup (tahap integrasi berikutnya):
- Form Tambah Aktivitas di Detail Lead (pilih jenis, tanggal, ubah fase, detail, evidence).
- Timeline dan ringkasan aktivitas memakai nama/ikon/warna dari konfigurasi.
- Kolom `lead_activity.activity_type_id` dan penguncian hapus berdasarkan pemakaian nyata.

## Database
Tabel baru `lead_activity_types`:

| Kolom | Tipe | Catatan |
|---|---|---|
| id | VARCHAR(36) PK | uuid |
| company_id | VARCHAR(36) FK → company | cascade |
| name | VARCHAR(100) | unik per company |
| icon | VARCHAR(50) | key dari `LEAD_LABEL_ICONS` |
| color | VARCHAR(20) | preset: blue, purple, green, orange, gray, red, yellow, pink |
| description | VARCHAR(255) NULL | |
| is_active | BOOLEAN default true | |
| sort_order | INT default 0 | urutan tampil di form |
| created_at / updated_at | DATETIME(6) | |

Index unik `(company_id, name)`.

Kolom `lead_activity.activity_type` (string) tetap ada untuk aktivitas sistem (`registration`, `conversion`). Relasi ke tabel baru ditambahkan di tahap integrasi.

## Data awal
Enam jenis (Follow Up (FU), Penawaran, Visit / Survey, Meeting, Presentasi, Catatan) adalah **master jenis**, bukan aktivitas Lead. Disetujui: dibuat otomatis saat company baru register (dalam transaksi register), dapat diedit/dinonaktifkan/dihapus. Company lama: script sekali jalan, lokal saja (tidak di-commit).

## API
| Method | Path | Akses |
|---|---|---|
| GET | `/api/lead-activity-types?search=&status=&page=&limit=` | Semua user login |
| POST | `/api/lead-activity-types` | Owner |
| PUT | `/api/lead-activity-types/:id` | Owner |
| DELETE | `/api/lead-activity-types/:id` | Owner |

Aturan:
- Tenant dari JWT; field tak dikenal ditolak.
- Nama wajib, 1–100 karakter, unik per company (409).
- Ikon harus key yang dikenal; warna harus preset.
- Hapus: ditolak (409) bila sudah dipakai aktivitas Lead — pengecekan aktif setelah relasi ada di tahap integrasi; sarankan nonaktifkan.
- `status=active|inactive` untuk filter; form nanti hanya memakai yang aktif.

## Frontend
- Header `ConfigHeader` + tombol **Tambah Aktivitas**.
- Pencarian nama, filter status, tombol **Columns** (tampil/sembunyikan kolom).
- Tabel: Nama Aktivitas, Ikon (kotak berwarna), Warna (badge berlabel), Deskripsi, Status, Aksi (edit, hapus dengan konfirmasi).
- Modal tambah/edit: nama, ikon (grid semua ikon), warna (8 preset), deskripsi, toggle aktif.
- Pagination dengan baris per halaman; state loading dan kosong.
- Menu sidebar "Leads Activity Management" di CRM Configuration.

## Pengujian
Unit test use case: list/filter, create (duplikat nama, ikon/warna tidak valid), update, delete, isolasi tenant.

---

# Penyesuaian: Tahapan Won Deals

Owner dapat menandai satu tahapan pipeline Deal sebagai **Won Deals**.

- Kolom `stage.is_won` + `stage.won_guard` (unik per company) → hanya satu tahapan Won. Migrasi `20261120130000_add_won_stage`.
- Hanya tahapan `entity=deal`; tidak boleh sekaligus tahapan default; boleh sekaligus tahapan akhir.
- Menandai tahapan lain memindahkan tanda Won; tanda dapat dilepas (Won Deals menjadi 0).
- Tahapan Won selalu aktif (tidak dapat dinonaktifkan); boleh diubah walau sudah berisi Deal.
- Dashboard: Won Deals, Average Won Value, dan Sales Trend dihitung dari Deal di tahapan Won (sebelumnya dari status `isClosingStatus`). Lost Deals tetap dari status.
- UI: toggle "Hitung sebagai Won Deals" di form tahapan Deals Pipeline, badge "Won" di daftar tahapan dan preview kanban.
