# Foto Tipe dan Foto Varian — Design

Tanggal: 2026-11-25

## Tujuan
Tipe dan varian masing-masing dapat memiliki beberapa foto, dan keduanya terpisah.

## Keputusan
1. Foto opsional, maksimal **5 per tipe** dan **5 per varian**, 10 MB per foto sebelum dikompres.
2. Foto pertama adalah foto utama dan dapat diganti. Foto disimpan utuh tanpa crop.
3. Detail Unit memakai kelompok pertama yang ada: foto unit, foto varian, foto tipe, sampul proyek.
4. Tabel Types menampilkan foto utama tipe; galerinya mengelompokkan foto tipe dan foto tiap varian.
5. Tambah varian menyalin spesifikasi, tidak menyalin foto.

## Data
Kolom baru `product_media.type_variant_id` (FK ke `product_type_variants`, `ON DELETE CASCADE`).

| Foto | `variant_id` (tipe) | `type_variant_id` | `unit_id` |
|---|---|---|---|
| Proyek | NULL | NULL | NULL |
| Tipe | tipe | NULL | NULL |
| Varian | tipe milik varian | varian | NULL |
| Unit | NULL | NULL | unit |

`variant_id` foto varian tetap diisi agar query foto proyek (`variant_id IS NULL`) tidak ikut mengambil foto varian.
Query foto tipe wajib menyaring `type_variant_id IS NULL`. Foto tipe lama tidak berubah.

## API
Berlaku untuk simpan proyek (`POST`/`PUT /api/products`) dan rute varian, dalam satu transaksi.

Multipart: `payload` (JSON) dan berkas.

| Field | Indeks pada simpan proyek | Indeks pada rute varian |
|---|---|---|
| `typeImages` | `typeImageIndexes`: `[tipe, ...]` | tidak ada |
| `typeVariantImages` | `typeVariantImageIndexes`: `[[tipe, varian], ...]` | `typeVariantImageIndexes`: `[varian, ...]` |

`mediaOrder` pada tipe dan varian menentukan hasil akhir: ID foto tersimpan dan `"new:N"` untuk foto baru ke-N milik
tipe/varian itu. Yang pertama menjadi foto utama; foto tersimpan yang tidak disebut dihapus. Tanpa `mediaOrder`, foto
tersimpan tidak berubah dan foto baru ditambahkan di belakang.

Berkas baru dihapus bila transaksi gagal. Berkas lama dihapus setelah transaksi berhasil.

## Perilaku penghapusan
- Tipe yang memiliki foto dapat dihapus; foto dan berkasnya ikut terhapus. Riwayat harga tetap mencegah penghapusan.
- Varian yang dihapus menghapus foto dan berkasnya.

## Tahapan
1. Migrasi, backend, test.
2. Form wizard dan dialog Tipe.
3. Tabel Types dan galeri Detail Unit.
