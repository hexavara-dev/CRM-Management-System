# Spesifikasi Unit per Varian — Design

Tanggal: 2026-11-25
Status: diimplementasikan

## Tujuan
Spesifikasi unit (luas bangunan, luas tanah, lantai, kamar tidur, kamar mandi, carport) diisi **per varian**,
bukan per tipe. Harga, stok, dan unit sudah menempel di varian; spesifikasi masih di tipe, sehingga
Standard dan Premium pada tipe yang sama terpaksa memiliki spesifikasi yang sama.

## Istilah
| Istilah | Tabel | Contoh |
|---|---|---|
| Tipe | `product_variants` | Type 36 |
| Varian | `product_type_variants` | Standard, Premium |
| Spesifikasi | `product_attributes` dengan atribut `UNIT_TYPE` | kamar tidur = 2 |
| Fasilitas proyek | `product_attributes` dengan atribut `PROJECT` | Kolam Renang |

Di API dan Prisma, `variantId` berarti **tipe** dan `typeVariantId` berarti **varian**.

## Keputusan
1. Keenam field spesifikasi pindah ke varian. Tipe hanya menyimpan nama dan gambar.
2. Gambar tetap per tipe.
3. Tabel Types menampilkan rentang bila nilai antar varian berbeda; ekspor berisi satu baris per varian.
4. Setiap tipe tetap wajib memiliki minimal satu varian ("Default").

## Di luar lingkup
- Gambar dan denah per varian.
- Spesifikasi khusus per unit.
- Atribut spesifikasi baru di luar enam field yang ada.

## Data
```text
products
 ├─< product_attributes          fasilitas (tidak berubah)
 └─< product_variants            tipe: nama
      ├─< product_media          gambar tipe (tidak berubah)
      └─< product_type_variants  varian: harga, stok
           ├─< product_attributes  spesifikasi (baru)
           └─< product_units       tidak berubah
```

Kolom baru `product_attributes.type_variant_id` (VARCHAR(36), NULL):
- FK ke `product_type_variants`, `ON DELETE CASCADE`.
- Index, dan unique `(type_variant_id, attribute_id)`. Baris fasilitas bernilai NULL sehingga tidak terkena unique.

| Jenis baris | `variant_id` | `type_variant_id` |
|---|---|---|
| Fasilitas proyek | NULL | NULL |
| Spesifikasi varian | tipe milik varian | varian |

`variant_id` pada spesifikasi tetap diisi agar spesifikasi satu tipe dapat diambil sekaligus.
Nilainya ditentukan server dari varian, bukan dari client.

## Migrasi
Satu migrasi Prisma, dengan urutan:

1. Tambah kolom, index, dan FK.
2. Salin setiap spesifikasi tipe ke semua varian tipe itu (ID baru, nilai sama, tenant sama). Bila satu tipe
   punya nilai ganda untuk atribut yang sama, baris dengan `updated_at` terbaru yang dipakai.
3. Hapus baris tipe lama **hanya bila salinannya ada**. Spesifikasi tipe yang belum punya varian tidak dihapus.
4. Tambah unique `(type_variant_id, attribute_id)`.

Kondisi database lokal saat spec ditulis: 120 baris spesifikasi tipe, tanpa nilai ganda, tanpa tipe yang belum
punya varian, dan 21 baris fasilitas. Kondisi server belum diperiksa.

Migrasi mengubah struktur dan data, sedangkan DDL MySQL tidak dapat di-rollback otomatis. Backup database wajib
dibuat sebelum dijalankan di server. Hanya `migrate deploy` yang dipakai, bukan `migrate reset`.

## Backend
Semua akses dibatasi tenant dari JWT. Varian harus milik tipe, proyek, dan tenant yang sama.

### Simpan proyek: `POST /api/products`, `PUT /api/products/:id`
`attributes` pindah dari tipe ke varian:
```json
{
  "variants": [
    {
      "name": "Type 36",
      "typeVariants": [
        {
          "name": "Standard",
          "basePrice": 450000000,
          "stock": 10,
          "attributes": [{ "name": "Bedroom", "code": "bedroom", "dataType": "NUMBER", "value": 2 }]
        }
      ]
    }
  ]
}
```
- `variants[].attributes` ditolak dengan 400.
- Kode atribut ganda dalam satu varian ditolak.
- Penyimpanan tetap dalam transaksi yang sama dengan tipe, varian, lokasi, dan unit.
- Simpan sebagian (mis. hanya lokasi/unit) tidak boleh menghapus atau mengubah spesifikasi.
- Atribut yang tidak dikirim tidak dihapus, seperti perilaku sekarang.

### Varian: `POST /api/products/:id/variants`, `PUT /api/products/:id/variants/:variantId`
- `typeVariants[].attributes` diterima, divalidasi, dan disimpan dalam transaksi yang sama.
- Dialog Tipe tidak lagi mengirim enam request atribut terpisah, sehingga tidak ada penyimpanan sebagian.

### Atribut: `/api/products/:id/attributes`
- Body spesifikasi memakai `typeVariantId`; `variantId` tidak lagi diterima.
- Tanpa `typeVariantId` berarti fasilitas proyek dan atributnya harus `PROJECT`.
- Dengan `typeVariantId` atributnya harus `UNIT_TYPE`.

### Baca
- Detail proyek dan edit-data: setiap baris `attributes` memuat `typeVariantId`.
- Availability Detail Unit: `buildingArea`, `landArea`, dan `specifications` diambil dari varian unit. Bentuk
  respons tidak berubah.

### Pesan error
| Kondisi | Status |
|---|---|
| Varian tidak ditemukan atau milik tenant/proyek lain | 404 |
| `attributes` dikirim di tipe, kode ganda, nilai bukan bilangan bulat | 400 |
| Sumber atribut tidak sesuai level | 400 |
| Atribut sudah punya nilai di varian itu (`POST attributes`) | 409 |

Pesan yang ada harus diperiksa terhadap `HttpErrorMapper`, karena status ditentukan dari isi pesan.

## Frontend

### Modal Unit Type (wizard) dan dialog Tambah/Edit Tipe
- Modal dua panel dengan tinggi tetap. Kiri: info tipe (nama, gambar) dan daftar varian. Kanan: form varian terpilih
  berisi nama, stok, harga, dan enam field spesifikasi.
- Daftar varian menampilkan stok dan ringkasan, mis. "LB 36 · LT 60 · 2 KT · 1 KM", atau "Belum lengkap".
- Tipe baru dimulai dengan satu varian "Default".
- **Tambah** menyalin spesifikasi varian terpilih; nama, stok, dan harga kosong.
- Field wajib yang kosong di varian lain membuat varian itu terpilih saat simpan, agar validasi tidak gagal
  tanpa pesan.
- Varian yang punya unit tetap tidak dapat dihapus. Stok tetap maksimal 1000.

### Tabel Unit Type (wizard)
Kolom spesifikasi pindah ke baris varian. Baris tipe menampilkan nama, gambar, jumlah varian, total stok, dan
harga mulai.

### Halaman Types
- Nilai sama di semua varian ditampilkan sekali; berbeda ditampilkan sebagai rentang, mis.
  "LB 36–45 m² | LT 60–72 m²" dan "2–3 Kamar Tidur".
- Ekspor PDF dan Excel: satu baris per varian, dengan kolom Varian. Kolom proyek dan tipe digabung.
- Unit Dibuat pada ekspor dihitung per varian.

### Detail Unit
Tampilan tidak berubah; nilainya mengikuti varian unit.

## Seeder
`realisticProjects.ts` dan `reservationSeed.ts` mengisi spesifikasi di varian. Data contoh memakai nilai berbeda
untuk sebagian varian Premium agar tampilan rentang dapat diuji. Seeder tidak dijalankan otomatis.

## Kompatibilitas
Bentuk request berubah, jadi backend dan frontend harus dirilis bersamaan. Halaman wizard atau Types yang masih
terbuka dengan kode lama akan mendapat error 400 dan perlu dimuat ulang.

## Tahapan
1. **Database dan backend**: migrasi, use case, validasi, seeder, test.
2. **Form**: modal Unit Type dan dialog Tipe.
3. **Tampilan**: tabel Unit Type, halaman Types, ekspor.

Ketiga tahap di-merge bersamaan. Prasyarat lokal: migrasi lain dari `main` sudah diterapkan.

## Pengujian
Backend (Jest):
- Spesifikasi tersimpan per varian saat create dan edit; nilai dua varian dapat berbeda.
- Simpan sebagian tidak mengubah spesifikasi.
- `attributes` di tipe dan kode ganda ditolak.
- Varian tenant atau proyek lain ditolak.
- Detail Unit memakai spesifikasi varian unit, bukan varian lain pada tipe yang sama.
- Fasilitas proyek tidak terpengaruh.

Migrasi, pada salinan database lokal:
- Jumlah baris spesifikasi setelah migrasi = jumlah pasangan unik (varian, atribut) dari data lama.
- Nilai setiap varian sama dengan nilai tipenya sebelum migrasi.
- Jumlah dan isi baris fasilitas tidak berubah.

Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `build-payload.check.ts`.

Manual:
- Tambah tipe dengan dua varian berspesifikasi berbeda, simpan, lalu edit kembali.
- Buka Detail Unit dari kedua varian dan pastikan nilainya berbeda.
- Simpan edit proyek dari step Information dan pastikan spesifikasi tidak berubah.
- Ekspor PDF dan Excel dari halaman Types.
