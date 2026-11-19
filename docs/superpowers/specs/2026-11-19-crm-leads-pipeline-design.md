# Konfigurasi Leads Pipeline — Design

Tanggal: 2026-11-19
Menu: CRM Configuration → Konfigurasi Leads Pipeline (`/crm-configuration/leads-pipeline`)

## Tujuan

Setiap company mengatur tahapan (stage) pipeline Lead: nama, deskripsi, probabilitas, warna, status, urutan, serta evidence/persyaratan yang wajib diunggah saat Lead dipindahkan ke tahapan tersebut.

## Kondisi saat ini

- Tabel `stage` (`entity_type` = `lead` | `deal`): `name`, `position`, `color`, `is_default`, `is_terminal` (+ guard unik per company dan tipe).
- API `/api/stage` (StageController/StageUseCase): list, create, update, delete, `PUT /api/stage/reorder`.
- Tahapan dikelola langsung di kanban halaman Leads (tab Pipeline): tambah, edit, hapus, geser kolom.
- Belum ada deskripsi, probabilitas, status aktif, maupun evidence.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Simpan | Tambah/edit/hapus/toggle status langsung tersimpan. **Simpan Perubahan** khusus menyimpan urutan setelah mode **Atur Urutan**. |
| 2 | Preview Pipeline | Modal pratinjau kanban (kolom tahapan aktif seperti yang dilihat sales). |
| 3 | Tipe file evidence | Pilihan tetap, boleh lebih dari satu: `PDF`, `DOC` (DOC/DOCX), `IMAGE` (JPG/PNG), `SHEET` (XLS/XLSX). |
| 4 | Default & akhir | Aturan stage default dan stage akhir dipertahankan; ditandai badge; keduanya tidak bisa dinonaktifkan atau dihapus. |
| 5 | Hapus | Tahapan yang masih berisi Lead tidak boleh dihapus (409). |
| 6 | Kanban Leads | Pengelolaan tahapan (tambah/edit/hapus/geser kolom) dihapus dari kanban Leads; kanban hanya memindahkan Lead. |
| 7 | Data awal | Tanpa data default; stage yang ada tetap dipakai dan berstatus aktif. |
| 8 | Cakupan evidence | Hanya konfigurasi. Kewajiban unggah saat Lead dipindah dikerjakan di task berikutnya. |
| 9 | Multi-tenant | `company_id` dari JWT; semua operasi di-scope ke company; stage company lain → 404. |
| 10 | Hak akses | Membaca: semua user login. Mengubah: owner. |

## Database

Migrasi `extend_pipeline_stages` (hanya menambah):

```sql
ALTER TABLE `stage`
  ADD COLUMN `description` VARCHAR(500) NULL,
  ADD COLUMN `probability` INT NOT NULL DEFAULT 0,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `stage_evidence_requirements` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `stage_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `file_types` JSON NOT NULL,          -- mis. ["PDF","DOC"]
  `is_required` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX (`stage_id`, `sort_order`),
  FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`stage_id`) REFERENCES `stage`(`id`) ON DELETE CASCADE
);
```

## API

Endpoint baru dengan parameter tipe pipeline, agar dapat dipakai ulang oleh Konfigurasi Deals Pipeline:

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/pipeline-stages?entity=lead` | Login | Semua tahapan (aktif dan nonaktif) urut `position`, beserta `evidences` dan `itemCount` (jumlah Lead, atau Deal untuk `entity=deal`) |
| POST | `/api/pipeline-stages` | Owner | `{ entity, name, description?, probability, color, evidences: [{ name, fileTypes, isRequired }] }` |
| PUT | `/api/pipeline-stages/:id` | Owner | Field yang sama (parsial), `isActive`; `evidences` bila dikirim menggantikan seluruh daftar |
| PUT | `/api/pipeline-stages/reorder` | Owner | `{ entity, ids: [...] }` urutan baru, harus berisi semua tahapan tipe tersebut |
| DELETE | `/api/pipeline-stages/:id` | Owner | 204; 409 bila masih berisi Lead, atau tahapan default/akhir |

Validasi:
- `entity` = `lead` (`deal` disiapkan untuk task Deals Pipeline).
- `name` 1–100 karakter, unik per company + tipe (409, tanpa membedakan huruf besar/kecil).
- `probability` bilangan bulat 0–100.
- `color` `#RRGGBB`, `description` maks. 500.
- `evidences` maks. 20; `name` 1–150; `fileTypes` minimal satu dari daftar; nama evidence unik dalam satu tahapan.
- Tahapan default/akhir tidak dapat dinonaktifkan (409).
- Create dan update tahapan beserta evidence dalam satu transaksi.
- Field lain (termasuk `tenantId`, `position`) ditolak.

Layer: `PipelineStageController` → `PipelineStageUseCase` → Prisma. `/api/stage` lama tidak diubah (masih dipakai kanban untuk kolom dan pemindahan Lead).

## Frontend

Halaman `/crm-configuration/leads-pipeline`, mengikuti mockup:
- `ConfigHeader` (ikon, judul, deskripsi) dengan tombol **Preview Pipeline** dan **Simpan Perubahan** (aktif hanya saat urutan berubah).
- Pita chevron tahapan aktif sesuai urutan dan warna.
- Kartu **Daftar Tahapan Pipeline**: tombol **Atur Urutan** dan **Tambah Tahapan** (owner).
- Tabel: pegangan geser (aktif di mode Atur Urutan), Tahapan (+ badge Default/Akhir), Deskripsi, Probabilitas (badge %), Warna, Status (toggle, langsung tersimpan), Aksi (edit, hapus).
- Mode Atur Urutan: baris dapat digeser (dnd-kit, sudah dipakai kanban); **Simpan Perubahan** menyimpan, **Batal** mengembalikan.
- Modal Tambah/Edit Tahapan (lebar, mengikuti mockup):
  - Informasi Tahapan: Nama, Warna (picker + hex), Deskripsi, Probabilitas (%).
  - Evidence & Persyaratan: tabel nama evidence, tipe file (multi-select), wajib (toggle), hapus, geser urutan, **Tambah Evidence**.
  - Preview Tahapan: chevron, probabilitas, warna.
- Modal Preview Pipeline: kolom kanban tahapan aktif (nama, warna, probabilitas, jumlah Lead).
- Hapus dengan konfirmasi; pesan 409 ditampilkan.
- Loading, kosong, error; non-owner hanya melihat; responsif.

Halaman Leads (tab Pipeline): tombol tambah/edit/hapus tahapan dan geser kolom dihapus; ditambah tautan ke halaman konfigurasi bagi owner.

## Test

- Use case: list di-scope tenant + tipe dengan evidence dan jumlah Lead; create/update dengan evidence dalam transaksi; nama duplikat 409; stage tenant lain 404; hapus ditolak bila berisi Lead atau default/akhir; nonaktifkan default/akhir ditolak; reorder harus lengkap dan milik tenant.
- Validasi: probabilitas, warna, evidence (tipe file, jumlah, nama unik), field tidak dikenal.

## Di luar cakupan

- Kewajiban unggah evidence saat Lead dipindahkan tahapan.
- Konfigurasi Deals Pipeline (memakai API yang sama dengan `entity=deal`).
- Menyembunyikan tahapan nonaktif dari kanban Leads.
