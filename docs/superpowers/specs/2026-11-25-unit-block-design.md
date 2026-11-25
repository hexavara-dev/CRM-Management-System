# Block Unit — Design

Tanggal: 2026-11-25
Status: rancangan, belum dikerjakan

## Tujuan
Owner dapat menahan unit agar tidak dijual (misalnya sengketa, unit contoh, atau ditahan manajemen) dan membukanya kembali,
dengan alasan dan riwayat yang tercatat.

## Kondisi sekarang
- Status `BLOCKED` sudah ada di `ProductUnitStatus` dan tampil di Availability, Project, dan Pricing.
- Tidak ada aksi di tampilan yang menghasilkan atau membuka `BLOCKED`. Reservasi tidak memakainya, dan Edit Project menolak
  perubahan status unit.
- `POST /api/products` masih menerima status apa pun untuk unit baru.
- Reservasi hanya menerima unit `AVAILABLE`, jadi unit `BLOCKED` sudah ditolak. Tombol reservasi di Detail Unit juga sudah
  mati bila status bukan `Available`.
- `DealUseCases.create` hanya memeriksa bahwa unit milik company, tidak memeriksa statusnya.

## Keputusan
1. Hanya owner yang dapat memblokir dan membuka block. Semua user company dapat melihat alasan dan riwayatnya.
2. Hanya unit `AVAILABLE` tanpa reservasi berjalan (`ACTIVE`, `PAYMENT_PENDING`) yang dapat diblokir.
3. Alasan block wajib diisi; catatan buka block opsional.
4. Buka block mengembalikan unit ke `AVAILABLE`. Riwayat tidak dihapus.
5. Riwayat memakai `audit_log` yang sudah ada. Tidak ada migration.
6. Unit baru selalu `AVAILABLE`; `POST /api/products` menolak status lain.

### Menunggu persetujuan
- Deal baru untuk unit `BLOCKED` ditolak; Deal lama tidak diubah. Rekomendasi: ya.

## Alur status
```
AVAILABLE --block + alasan (owner)--> BLOCKED
BLOCKED --buka block (owner)--> AVAILABLE
```
Perubahan status memakai `updateMany` bersyarat status asal, sama seperti klaim unit pada reservasi. Jika ada yang memblokir
dan mereservasi bersamaan, hanya satu yang berhasil. Status dan `audit_log` ditulis dalam satu transaksi.

## Data `audit_log`

| Kolom | Nilai |
|---|---|
| `entity_type` | `product_unit` |
| `entity_id` | ID unit |
| `action` | `unit_blocked` atau `unit_unblocked` |
| `actor_id` | user dari JWT |
| `changes` | `{ "from", "to", "reason" }`; pada `unit_unblocked`, `reason` berisi catatan atau `null` |

Unit `BLOCKED` dari seeder atau data lama tidak punya riwayat; alasannya ditampilkan sebagai "-" dan tetap dapat dibuka.

## API

| Rute | Akses | Body |
|---|---|---|
| `POST /api/units/:id/block` | owner | `reason`: wajib, di-trim, maksimal 500 karakter |
| `POST /api/units/:id/unblock` | owner | `note`: opsional, maksimal 500 karakter |
| `GET /api/units/:id/block-history` | semua user | - |

- `block` dan `unblock` mengembalikan `{ id, status }`.
- Riwayat terurut dari yang terbaru: `{ data: [{ id, action, reason, actorName, createdAt }] }`.
- `tenantId` dan pelaku selalu dari JWT.

| Keadaan | Kode |
|---|---|
| Alasan kosong atau terlalu panjang | 400 |
| Bukan owner | 403 |
| Unit tidak ada atau milik company lain | 404 |
| Status tidak sesuai, ada reservasi berjalan, atau kalah bersamaan | 409 |

## Tampilan
Detail Unit Availability:
- Kartu info unit: tombol **Block Unit** saat `Available`, **Buka Block** saat `Blocked`; hanya untuk owner.
- Modal Block: alasan wajib. Modal Buka Block: catatan opsional.
- Saat `Blocked`: alasan, pelaku, dan waktu block ditampilkan.
- Kartu Riwayat Block tampil hanya bila unit punya riwayat.
- Setelah aksi, data Availability, unit, project, pricing, dan pilihan unit reservasi dimuat ulang.

## Yang perlu dijaga
- Seeder realistis membuat unit berstatus selain `AVAILABLE` lewat `ProductUseCase.create`. Penolakan status dilakukan di
  validasi API, bukan di use case, agar seeder tetap berjalan.
- Unit `BLOCKED` tidak dapat dihapus dari Edit Project (sudah berlaku untuk semua status selain `AVAILABLE`).
- Harga unit `BLOCKED` tetap dapat diatur di Pricing.

## Tahapan
1. **Backend:** use case, rute, validasi, penolakan status unit baru, dan test.
2. **Tampilan Detail Unit:** tombol, modal, info block, dan riwayat.
3. **Uji menyeluruh:** block, reservasi ditolak, angka Blocked di Availability berubah, buka block, reservasi berhasil. Data
   uji dibersihkan.

## Test
- Alasan wajib; panjang maksimal.
- Member ditolak; company lain mendapat 404.
- Block ditolak untuk `BOOKED`, `RESERVED`, `SOLD`, `BLOCKED`, dan unit dengan reservasi berjalan.
- Buka block ditolak bila unit bukan `BLOCKED`.
- Kalah bersamaan menghasilkan 409 tanpa baris `audit_log`.
- `POST /api/products` menolak unit baru selain `AVAILABLE`.

## Di luar cakupan
Block massal, block berjangka waktu, dan alur persetujuan.
