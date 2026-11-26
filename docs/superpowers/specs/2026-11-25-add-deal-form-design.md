# Form Tambah Deal — Design

Tanggal: 2026-11-25
Status: rancangan, belum dikerjakan

## Tujuan
Deal dapat dibuat dari **Tambah Deal** di Deals Management, hanya untuk Lead yang sudah ada. Jalur **Convert to Deal** di
Detail Lead tetap seperti sekarang.

## Kondisi sekarang
- `POST /api/deal` selalu membalas 405; Deal hanya dibuat lewat `POST /api/lead/:id/convert`.
- Convert tidak memeriksa status unit, harga resmi, atau dokumen; tidak mengisi Target Closing; mata uang default USD.
- Status unit tidak berubah setelah Deal dibuat, Won, Lost, atau dihapus.
- Dokumen per fase ada di Deals Pipeline (`stage_evidence_requirements`), tetapi tidak dipakai Deal. `attachment` tidak mencatat
  dokumen apa yang diunggah.
- Menyimpan tahapan pipeline menghapus dan membuat ulang seluruh evidence, jadi ID evidence tidak tetap.

## Keputusan
1. Satu Lead menghasilkan satu Deal. Pilihan Lead: belum converted, tidak diarsipkan, dan dapat diakses user.
2. Tanpa Lead, Deal tidak dapat dibuat. Form menampilkan pesan dan link ke Daftar Leads.
3. Pekerjaan ini hanya **Tambah Deal** di Deals Management. Convert to Deal di Detail Lead dikerjakan terpisah dan tidak diubah.
4. Hanya unit `AVAILABLE` yang dapat dipilih.
5. Harga Deal terisi harga jual resmi Pricing hari ini dan tidak boleh lebih rendah.
6. Project minat Lead mengisi pilihan project, tetapi project lain boleh dipilih.
7. Fase awal otomatis mengikuti tahapan default Deals Pipeline. Tanpa tahapan default aktif, Deal ditolak.
8. Dokumen persyaratan diambil dari evidence **tahapan pertama** Deals Pipeline (tahapan default), disaring menurut jenis
   pembayaran, ditambah satu baris bawaan **Dokumen Tambahan** (opsional).
9. Dokumen wajib harus lengkap sebelum disimpan.
10. KPR dan KPR Syariah wajib memilih bank aktif. Pilihan bank muncul setelah jenis pembayaran dipilih.
11. Deal baru memakai IDR. Sales penanggung jawab mengikuti Lead.
12. Owner dapat memakai semua Lead company; sales hanya Lead yang dapat mereka akses (aturan `getLead`).

13. Deal dihapus: Lead kembali dapat dibuatkan Deal (`converted` dikembalikan).
14. Deal Lost: Lead tidak dapat dibuatkan Deal lagi; Deal lama menjadi riwayat.
15. Pembatasan akses berkas KTP/KK dikerjakan terpisah. Saat ini semua user company yang punya URL-nya dapat membuka.

## Status unit
Satu aturan untuk semua perubahan Deal:

| Keadaan Deal | Status unit |
|---|---|
| Berjalan | `RESERVED` |
| Tahapan Won, atau status closing | `SOLD` |
| Status Lost | `AVAILABLE` |
| Deal dihapus | `AVAILABLE` |

- Semua perubahan bersyarat status asal (`updateMany`), dalam transaksi yang sama dengan perubahan Deal. Deal, Reservasi, dan
  Block Unit yang berebut satu unit: hanya satu yang berhasil.
- `deal.unit_claimed` menandai Deal yang memegang unit. Deal lama bernilai `false` dan tidak pernah mengubah status unit, supaya
  tidak melepas unit milik reservasi.
- Mengganti unit pada Deal berjalan: unit baru diklaim, unit lama dilepas. Harga diperiksa terhadap unit baru.
- Deal yang dibuka lagi dari Lost harus mengklaim unitnya lagi; jika sudah diambil, ditolak 409.
- Deal tidak dapat dipindah ke Lead lain. Harga yang sudah disepakati tetap berlaku sampai harga atau unitnya diubah.
- Lost terjadi lewat persetujuan pengajuan Lost atau perubahan status; keduanya memakai aturan yang sama.

## Data (migration)

| Tabel | Kolom | Keterangan |
|---|---|---|
| `stage_evidence_requirements` | `description` VARCHAR(255) NULL | Keterangan dokumen |
| `stage_evidence_requirements` | `payment_methods` JSON NULL | `NULL` = semua jenis pembayaran; hanya untuk pipeline Deal |
| `attachment` | `document_name` VARCHAR(150) NULL | Salinan nama dokumen saat diunggah |
| `attachment` | `document_stage_id` VARCHAR(36) NULL | FK tahapan, `ON DELETE SET NULL` |
| `deal` | `unit_claimed` BOOLEAN DEFAULT false | Deal memegang status unit |

Attachment tidak mereferensikan ID evidence karena ID itu berganti setiap konfigurasi disimpan.

## API

### `POST /api/deal` (multipart)
`payload` (JSON):

| Field | Aturan |
|---|---|
| `leadId`, `unitId` | wajib, milik company |
| `amount` | wajib, bilangan bulat, minimal harga jual resmi |
| `paymentMethod` | `CASH`, `KPR`, `KPR_SHARIA` |
| `financingBankId` | wajib untuk KPR, kosong untuk CASH |
| `expectedClosingDate` | wajib, tidak sebelum hari ini |
| `notes` | opsional |
| `documents` | `[{ name, fileIndex }]`; nama harus ada pada daftar dokumen yang berlaku, atau `Dokumen Tambahan` |

Berkas: `documents`, PDF/gambar/DOC/XLS sesuai konfigurasi, 10 MB per berkas, maksimal 21 berkas.

Satu transaksi: klaim Lead (`converted = false`), klaim unit, buat Deal, attachment, aktivitas Lead dan Deal, dan audit log. Berkas
ditulis lebih dulu dan dihapus lagi bila transaksi gagal.

`POST /api/lead/:id/convert` tidak diubah: belum mengunci unit, memeriksa harga resmi, atau meminta dokumen.

| Keadaan | Kode |
|---|---|
| Field, harga, bank, atau dokumen tidak valid; dokumen wajib kurang | 400 |
| Lead atau unit tidak ada, milik company lain, atau di luar akses | 404 |
| Lead sudah converted; unit tidak tersedia; tidak ada tahapan default | 409 |

### Pilihan Lead
`GET /api/lead/deal-options`: `search` dan pagination; nama, telepon, email, label, dan project minat.

## Tampilan
Modal **Tambah Deal** dari tombol di Deals Management:
- **Pilih Lead:** dropdown dengan pencarian, lalu kartu ringkas Lead.
- **Informasi Deal:** project, unit, harga, jenis pembayaran, bank (KPR), target closing, fase awal (baca saja).
- **Dokumen Persyaratan:** tabel dokumen, tanda Wajib/Opsional, status, unggah, lihat, hapus, dan progres dokumen wajib.
- Berkas dikirim saat Simpan Deal. Mengganti jenis pembayaran memperbarui daftar; berkas yang tidak berlaku lagi dilepas.
- Setelah tersimpan: buka detail Deal, muat ulang Deals, Leads, Availability, unit, project, dan Pricing.

Teks info mengikuti sistem: "Daftar dokumen mengikuti konfigurasi Deals Pipeline (tahap dan jenis pembayaran)."

Konfigurasi Deals Pipeline: evidence mendapat Keterangan dan "Berlaku untuk" (semua, atau pilihan jenis pembayaran).

## Tahapan
1. **Docs** (dokumen ini).
2. **Konfigurasi dokumen:** migration, API, dan form Deals Pipeline.
3. **Backend create Deal:** klaim Lead dan unit, harga, dokumen, pilihan Lead.
4. **Form Tambah Deal**.
5. **Status unit** saat Won, Lost, ganti unit, dibuka lagi, dan dihapus.
6. **Uji menyeluruh** dengan data uji yang dibersihkan.

Tahap 3 dan 5 harus dirilis bersama: tanpa tahap 5, unit yang diklaim tidak pernah dilepas.

## Test
- Lead milik company lain, diarsipkan, di luar akses, atau sudah converted ditolak.
- Dua permintaan bersamaan untuk Lead atau unit yang sama: hanya satu berhasil.
- Harga di bawah harga jual resmi ditolak; project di luar minat Lead diterima.
- Dokumen wajib kurang, nama tidak dikenal, dan tipe berkas salah ditolak.
- Dokumen mengikuti jenis pembayaran.
- Transaksi gagal: tidak ada Deal, klaim, atau berkas tersisa.
- Deal lama (`unit_claimed = false`) tidak mengubah status unit.
- Setiap baris tabel status unit.

## Di luar cakupan
Convert to Deal, membuat Deal dari Reservasi (Reservasi belum terhubung ke Lead), dokumen saat pindah fase, pembatasan akses berkas, dan halaman
kelola bank. Tanpa bank aktif, Deal KPR tidak dapat dibuat.
