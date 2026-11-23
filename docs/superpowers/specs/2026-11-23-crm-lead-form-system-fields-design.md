# Form Template: Field Sistem, Section, dan Form Add Lead — Design

Tanggal: 2026-11-23

## Tujuan
Form Add Lead dirender dari **template default** company. Selain custom field, template dapat memuat
**field sistem** yang terhubung ke data CRM asli (proyek, sumber, campaign, sales, label) dan **section**
untuk mengelompokkan field, seperti mockup Add New Lead.

"Buat Deal Sekaligus" dan tombol simpan adalah perilaku form, di luar template.
Status Qualified dan Umur di luar lingkup.

## Tahapan
1. **Konfigurasi template**: field sistem dan section di backend (validasi, versi) dan editor/preview.
2. **Data Lead**: kolom/relasi baru dan API create Lead yang membaca template default.
3. **Form Add Lead**: dirender dari template default sesuai mockup.

## Jenis elemen template
| Jenis | Disimpan | Keterangan |
|---|---|---|
| Field standar/sistem | kolom/relasi asli | kunci tetap, tipe tetap; label, placeholder, bantuan, wajib, posisi dapat diatur |
| Custom field | `lead.custom_values` (JSON) | tipe bebas seperti sekarang |
| Section | tidak menyimpan data | judul, deskripsi, ikon; field setelahnya masuk section itu sampai section berikutnya |

## Katalog field sistem
| Kunci | Label bawaan | Tipe | Selalu ada | Wajib | Disimpan di (Tahap 2) |
|---|---|---|---|---|---|
| `name` | Nama Lengkap | TEXT | ya | selalu | customer.name |
| `phone` | Nomor HP | PHONE | ya | dapat diatur | customer.phone |
| `email` | Email | EMAIL | ya | dapat diatur | customer.email |
| `lead_source` | Sumber Lead | LEAD_SOURCE | ya | selalu | lead.source_id |
| `assigned_sales` | Assigned Sales | USER | ya | dapat diatur (kosong = pembuat Lead) | lead.assigned_user_id |
| `customer_gender` | Jenis Kelamin | GENDER | tidak | dapat diatur | customer.gender |
| `customer_address` | Alamat | TEXTAREA | tidak | dapat diatur | customer.address |
| `interest_projects` | Project Diminati | PROJECT (multi) | tidak | dapat diatur | `lead_interests` |
| `interest_types` | Tipe Rumah | PROJECT_TYPE (multi, per proyek) | tidak | dapat diatur | `lead_interests.variant_id` |
| `lead_budget` | Budget Pembelian | CURRENCY | tidak | dapat diatur | lead.budget |
| `lead_notes` | Catatan Kebutuhan / Preferensi | TEXTAREA | tidak | dapat diatur | lead.notes |
| `lead_campaign` | Campaign | CAMPAIGN | tidak | dapat diatur | lead.campaign_id |
| `lead_temperature` | Status Lead | LEAD_LABEL (Temperature) | tidak | dapat diatur | relasi label |

Aturan:
- Field sistem hanya boleh muncul sekali per template; tipe dan pilihannya ditentukan server.
- Tipe relasi (PROJECT, PROJECT_TYPE, LEAD_SOURCE, CAMPAIGN, USER, LEAD_LABEL, GENDER) hanya boleh untuk kunci sistemnya; custom field tidak dapat memakainya.
- `interest_types` membutuhkan `interest_projects`; pilihan tipe mengikuti proyek yang dipilih.
- Field yang selalu ada dan belum dikirim ditambahkan otomatis (Nama/HP/Email di awal; Sumber dan Sales di akhir). Template lama ikut menampilkannya saat dibaca.
- Kunci sistem baru memakai awalan (`lead_`, `customer_`, `interest_`) agar tidak bentrok dengan kunci custom field yang sudah ada.

## Section
- Tipe `SECTION`, kunci otomatis `section_*`, label = judul, `helpText` = deskripsi, `icon` dari daftar ikon bersama.
- Tidak dihitung dalam jumlah field; tidak memiliki wajib/pilihan.
- Field sebelum section pertama tampil tanpa judul grup.

## Data Lead (Tahap 2)
- `customer.gender` (enum), `customer.address`.
- `lead.budget` (BIGINT, rupiah), `lead.notes` (TEXT), `lead.campaign_id`, `lead.form_template_version_id`, `lead.custom_values` (JSON).
- Tabel `lead_interests`: lead, proyek (wajib), tipe (opsional); unik per (lead, proyek, tipe). Semua relasi dicek milik company yang sama.
- Create Lead memvalidasi isian terhadap versi template default dan mengunci versi tersebut (`is_locked`).

## Implementasi Tahap 2
- Migrasi `20261123090000_add_lead_form_submission`: `lead.budget`, `lead.needs_notes`, `lead.campaign_id`, `lead.temperature_label_id`, `lead.form_template_version_id`, `lead.custom_values`, dan tabel `lead_interests`.
- Jenis kelamin memakai `customer.gender`; alamat memakai `customer.location` (kolom yang sudah ada).
- `GET /api/lead-form`: template default aktif beserta versi terbaru dan daftar field (field yang selalu ada ditambahkan bila belum tersimpan).
- `POST /api/lead-form/submissions` `{ templateVersionId, values }`:
  - versi harus versi terbaru template default (409 bila form sudah berubah);
  - kunci tak dikenal ditolak; wajib dan tipe divalidasi per field sesuai versi;
  - relasi dicek milik company: sumber aktif, sales, campaign aktif dalam periode dan milik sumber yang dipilih, label Temperature aktif, proyek aktif, tipe milik proyek terpilih;
  - satu transaksi: customer, lead (tahapan default, sales kosong = pembuat), `lead_interests`, aktivitas `registration`, dan mengunci versi template.
- Hapus campaign atau label Temperature yang sudah dipakai Lead ditolak (409).
- Route lama `POST /api/lead` tetap ada untuk form lama sampai Tahap 3 selesai.
