# Unit Price Bulk Adjustment & Location Filter — Design

Tanggal: 2026-11-16
Lanjutan dari: `2026-11-13-unit-price-management-design.md` (CRM-14)

## Tujuan

1. Owner dapat mengubah harga jual banyak unit sekaligus (ubah massal).
2. Filter lokasi di halaman `/pricing` dipisah menjadi Cluster/Zona dan Blok agar unit lebih mudah dipilih.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Bentuk perubahan | Nominal Rp naik/turun, kumulatif per unit (sama dengan penyesuaian satuan). Persen dan "set harga sama" belum. |
| 2 | Cara memilih | Checkbox per baris dan per halaman. Pilihan tetap tersimpan saat pindah halaman. Belum ada "pilih semua yang cocok dengan filter". |
| 3 | Batas pilihan | Maksimal 100 unit per simpan, semua dari **satu project**. Tipe boleh campur. |
| 4 | Unit SOLD | Tidak bisa dipilih (checkbox nonaktif) dan ditolak di backend. |
| 5 | Atomik | Satu transaksi: semua unit tersimpan atau tidak ada sama sekali. |
| 6 | Riwayat | Satu baris `unit_price_adjustments` per unit dengan alasan dan tanggal efektif yang sama. Modal Riwayat tidak berubah. |
| 7 | Hak akses | Owner-only, sama seperti penyesuaian satuan. |
| 8 | Approval | Mengikuti `PRICE_APPROVAL_ENABLED` (saat ini nonaktif → semua langsung disetujui). Peringatan di bawah minimum tetap tampil per unit. |
| 9 | Database | Tanpa migrasi. |

## Tahap 1 — Filter Cluster/Zona → Blok (frontend saja)

Urutan filter: **Project → Cluster/Zona → Blok → Tipe → Status**.

- **Cluster/Zona**: aktif setelah Project dipilih. Berisi node lokasi non-BLOCK di bawah node project. Node yang bertingkat (mis. Zona di dalam Cluster) diberi keterangan jalur, mis. "Zona 1 · Cluster Utara".
- **Blok**: aktif setelah Project dipilih. Jika Cluster/Zona dipilih, hanya blok di bawahnya; jika tidak, semua blok project dengan keterangan jalurnya.
- Project tanpa cluster: filter Cluster/Zona nonaktif dengan teks "Tidak ada cluster".
- Mengganti Project mengosongkan Cluster/Zona, Blok, dan Tipe. Mengganti Cluster/Zona mengosongkan Blok.
- Parameter ke API tetap `categoryId` = Blok bila dipilih, selain itu Cluster/Zona. Backend sudah menyertakan semua turunan lokasi (`categoryWithDescendants`), jadi tidak ada perubahan backend.

## Tahap 2 — Backend ubah massal

`POST /api/unit-prices/bulk-adjustments` (owner-only)

Request:
```json
{ "unitIds": ["..."], "amount": 5000000, "reason": "Kenaikan harga Q4", "effectiveDate": "2026-11-16" }
```

Validasi (API boundary):
- `unitIds`: array string unik, 1–100 item.
- `amount`, `reason`, `effectiveDate`: aturan sama dengan penyesuaian satuan (integer ≠ 0, alasan 3–500 karakter, tanggal `YYYY-MM-DD` ≥ hari ini Asia/Jakarta).

Aturan use case:
- Semua unit harus milik tenant aktor; id yang tidak ditemukan → 404 dengan daftar id.
- Semua unit harus dari satu project → 400 jika campur.
- Ada unit SOLD → 409 dengan daftar kode unit.
- Ada unit dengan penyesuaian PENDING → 409 (hanya relevan bila approval aktif).
- Harga sesudah < 0 pada unit mana pun → 400 dengan daftar kode unit.
- Per unit: `amount` tersimpan = penyesuaian aktif pada tanggal efektif + nominal; `price_before`, `price_after`, `min_price` dihitung per unit seperti penyesuaian satuan.
- Semua `create` dalam satu `prisma.$transaction`.

Response `201`:
```json
{ "count": 3, "data": [ { "unitId": "...", "code": "A-01", "priceBefore": 350000000, "priceAfter": 355000000, "status": "APPROVED" } ] }
```

Logika harga per unit di-refactor dari `createAdjustment` agar dipakai bersama oleh penyesuaian satuan dan massal (tanpa mengubah perilaku satuan).

Test: sukses multi-unit (kumulatif per unit), batas 100, campur project, unit SOLD, unit tenant lain, harga negatif, transaksi dipanggil sekali.

## Tahap 3 — Frontend ubah massal

- Kolom checkbox di tabel (hanya untuk owner). Checkbox header memilih/membatalkan semua unit non-SOLD di halaman itu.
- Checkbox aktif hanya setelah Project dipilih. Mengganti Project mengosongkan pilihan.
- Pilihan disimpan sebagai map `unitId → data baris` agar tetap ada lintas halaman dan filter dalam project yang sama.
- Bar aksi muncul saat ada pilihan: "N unit dipilih · Ubah harga massal · Batal". Tombol nonaktif bila N > 100.
- Modal ubah massal (responsive, dua kolom di desktop):
  - Kiri: Naik/Turun, nominal Rp, alasan, tanggal efektif (memakai komponen form yang sama dengan penyesuaian satuan).
  - Kanan: pratinjau daftar unit — kode, tipe, harga sekarang → harga sesudah, penanda di bawah minimum; ringkasan jumlah unit dan total perubahan.
- Hook `useBulkAdjustment` → invalidasi semua key harga; toast "N unit diperbarui"; pilihan dikosongkan setelah sukses.

## Di luar cakupan

- Perubahan persen atau set harga sama.
- Pilih semua unit yang cocok dengan filter (lintas halaman).
- Batch id / pengelompokan riwayat per ubah massal.
- Filter Kategori (node di atas project).
