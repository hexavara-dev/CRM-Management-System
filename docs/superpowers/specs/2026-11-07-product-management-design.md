# Desain Product & Availability Management (P1)

- **Tanggal:** 2026-11-07
- **Status:** Draft, menunggu review
- **Sumber:** brief `Product Availability System.pptx`, ERD product management, `Universal_Product_Master_Database_Design.xlsx`, dan `backend/prisma/schema.prisma`

## Latar belakang

CRM saat ini mengelola lead, deal, aktivitas, dan kunjungan, tetapi belum punya pengelolaan produk yang bisa dipakai pengguna. Tabel `Item`, `Entry`, dan sejenisnya hanya memiliki CRUD generik dan tidak dipanggil frontend.

Fitur ini dirancang umum untuk berbagai industri, seperti trading, distributor, rental, dan properti. **Tidak ada tabel, kolom, atau aturan yang khusus untuk satu industri.** Perbedaan antar bisnis diatur lewat konfigurasi: kategori, satuan, tipe lokasi, atribut, karakteristik, dan metode pelacakan.

Perumahan dan beras pada dokumen ini hanya contoh untuk menguji konsep.

## Tujuan P1

1. Master data: kategori, satuan, hierarki lokasi, atribut, dan karakteristik.
2. Katalog produk dan varian dengan metode pelacakan kuantitas, unit, atau tanpa pelacakan.
3. Inventory kuantitas: stock in, stock out, transfer, adjustment, dan opname.
4. Inventory unit: registrasi, lokasi, karakteristik, dan status.
5. Availability yang dihitung otomatis, bukan diinput manual.
6. Harga dasar dan penyesuaian harga per unit.
7. Media produk: foto, dokumen, dan link video.
8. Semua data terisolasi per company.

## Di luar cakupan

**P2, dikerjakan setelah P1:** reservasi, pembatalan, kedaluwarsa, approval, role lengkap, layar riwayat, dan laporan.

**Belum direncanakan:**
- Promo, yang ada di ERD tetapi tidak ada di brief.
- Hubungan produk dengan lead dan deal. `LeadItem` dihapus dan dirancang ulang saat P2.
- Purchase order, invoice, pembayaran, dan konversi antar satuan.

Desain P1 harus menyiapkan P2 tanpa membangunnya. Karena itu `qty_reserved`, `qty_allocated`, dan status unit `RESERVED` serta `BOOKED` sudah ada walau belum ada alur yang mengisinya.

## Keputusan desain

| No | Keputusan | Alasan |
| --- | --- | --- |
| 1 | `Tenant` diganti menjadi `Company`, dikerjakan lebih dulu dalam PR terpisah | Sesuai istilah bisnis. Biayanya paling rendah selagi masih dev. |
| 2 | `Item`, `ItemCategory`, `InventorySlot`, `GridConfig`, `Entry`, `Operation`, `Record`, dan `LeadItem` diganti | Tidak ada pemakaian dari frontend. Syarat: isinya sudah dicek kosong atau boleh hilang. |
| 3 | `Location` dipertahankan dan dikembangkan | Sudah dipakai Lead, Viewing, dan `use-locations`. |
| 4 | Kategori dan lokasi berada di tabel terpisah | Brief memisahkan keduanya, dan foreign key mencegah salah tautan. |
| 5 | Varian datar, tanpa `parent_id` | Brief hanya mengenal Product Type/Variant satu tingkat. Filter lebih mudah. |
| 6 | Varian dan karakteristik terpisah | Aturan brief. Varian adalah jenis yang ditawarkan. Karakteristik melekat pada unit, dan satu unit bisa punya banyak. |
| 7 | Setiap produk punya minimal satu varian | Stok, unit, dan harga selalu menunjuk varian. Produk tanpa variasi otomatis mendapat varian `Default`. |
| 8 | ID memakai UUID, harga memakai `DECIMAL(18,2)`, mata uang default `IDR` | Mengikuti pola kode saat ini, dan cukup untuk barang bernilai tinggi. |
| 9 | `tracking_type` terkunci setelah produk punya saldo, mutasi, atau unit | Satu produk hanya punya satu metode. Migrasi metode di luar cakupan P1. |
| 10 | Tidak ada tabel detail per industri | `property_unit_details` dari dokumen sumber diganti atribut dan karakteristik. |
| 11 | Endpoint baru bersifat khusus, bukan CRUD generik | Aturan stok tidak bisa ditegakkan lewat CRUD generik. |
| 12 | Hak akses P1: `owner` menulis, `member` membaca | Role lengkap baru dibutuhkan bersama approval di P2. |
| 13 | Media produk disimpan di tabel `product_media`, terpisah dari `Attachment` | `Attachment` untuk dokumen transaksi CRM. Galeri produk butuh urutan dan foto sampul. |
| 14 | Video disimpan sebagai link, bukan file | Batas upload 10 MB, dan disk server dipakai bersama aplikasi lain. |
| 15 | Kedalaman kategori dan lokasi tidak disimpan sebagai kolom `level` | Selalu bisa dihitung dari `parent_id`, sehingga tidak perlu diperbarui saat induk dipindah. |

## Perubahan dari skema dan ERD lama

### Schema Prisma saat ini

| Tabel lama | Tindakan | Pengganti |
| --- | --- | --- |
| `tenant` | Ganti nama (Fase 1) | `company`, ditambah kolom `address` |
| `item` | Hapus | `products` dan `product_variants` |
| `item_category` | Hapus | `product_categories` |
| `inventory_slot` | Hapus | `location` yang bertingkat |
| `grid_config` | Hapus | Tidak ada |
| `entry` | Hapus | `inventory_balances` |
| `operation`, `record` | Hapus | `inventory_transactions` |
| `lead_item` | Hapus | Dirancang ulang saat P2 |
| `location` | Kembangkan | Tambah `parent_id` dan `type` |
| `viewing` | Hapus kolom `slot_id` | Tidak ada |

Tabel CRM lainnya tidak berubah. Ikut dibersihkan: daftar model di `backend/src/index.ts`, aturan di `GenericUseCases.ts`, validasi dan DTO viewing, tipe `slotId` di frontend, serta test terkait.

### ERD product management sebelumnya

| Tabel di ERD | Tindakan | Perubahan |
| --- | --- | --- |
| `company` | Tetap | |
| `product_categories` | Ubah | Tambah `company_id`, `code`, `sort_order`, `is_active` |
| `product` | Ubah menjadi `products` | Tambah `company_id`, `category_id`, `base_uom_id`, `code`, `description`, `is_active`. `type` menjadi `tracking_type` dengan nilai `NONE`. Hapus baris placeholder. |
| `product_variants` | Ubah | Tambah `code`, `sku`, `barcode`, `is_active`. Pindahkan `base_price` ke `product_prices`. |
| `locations` | Ubah menjadi `location` | Tambah `type`. Hapus tabel duplikat di sisi kanan. |
| `units` | Ubah menjadi `product_units` | Tambah `serial_number`, `notes`. Status menjadi `AVAILABLE`, `RESERVED`, `BOOKED`, `SOLD`, `BLOCKED`. `location_id` wajib. Hapus `name`, dan pindahkan `characteristic` ke tabel sendiri. |
| `inventory_balances` | Tetap | `qty_reserved` dan `qty_allocated` bernilai 0 sampai P2 |
| `price_log` | Hapus | Diganti `product_prices` dan `unit_price_adjustments` |
| `promotions` | Tunda | Belum direncanakan |
| `deals`, `leads` | Tidak dibuat | Memakai tabel CRM yang ada. Relasi deal ke unit dibuat saat P2. |

Tabel baru: `units_of_measure`, `product_attributes`, `product_attribute_values`, `characteristic_groups`, `characteristics`, `unit_characteristics`, `unit_attribute_values`, `inventory_transactions`, `unit_status_history`, `product_prices`, `unit_price_adjustments`, dan `product_media`.

Perbaikan lain dari ERD: harga memakai `decimal`, bukan `int`. `company_id` ada di semua tabel. Contoh data unit memakai lokasi blok, bukan proyek. Kategori minyak memakai induk sembako, bukan beras.

## Model data

### Diagram ERD

Versi gambar lengkap dengan catatan dan contoh data: [PNG](2026-11-07-product-management-erd.png), [SVG](2026-11-07-product-management-erd.svg).

Diagram Mermaid di bawah adalah ringkasannya. Kolom `created_at` dan `updated_at` tidak digambarkan. Tabel CRM lain yang memakai `location`, seperti `lead` dan `viewing`, juga tidak digambarkan.

```mermaid
erDiagram
    company ||--o{ user : "punya"
    company ||--o{ location : "punya"
    company ||--o{ product_categories : "punya"
    company ||--o{ products : "punya"

    product_categories ||--o{ product_categories : "induk dari"
    product_categories ||--o{ products : "mengelompokkan"
    units_of_measure ||--o{ products : "satuan dasar"
    products ||--|{ product_variants : "punya minimal satu"
    products ||--o{ product_attribute_values : "spesifikasi"
    product_variants ||--o{ product_attribute_values : "spesifikasi"
    product_attributes ||--o{ product_attribute_values : "mendefinisikan"

    location ||--o{ location : "induk dari"

    product_variants ||--o{ inventory_balances : "saldo"
    location ||--o{ inventory_balances : "menyimpan"
    product_variants ||--o{ inventory_transactions : "mutasi"
    location ||--o{ inventory_transactions : "terjadi di"
    user ||--o{ inventory_transactions : "mencatat"

    product_variants ||--o{ product_units : "unit fisik"
    location ||--o{ product_units : "lokasi unit"
    product_units ||--o{ unit_characteristics : "punya"
    characteristic_groups ||--o{ characteristics : "berisi"
    characteristics ||--o{ unit_characteristics : "dipakai"
    product_units ||--o{ unit_attribute_values : "nilai aktual"
    product_attributes ||--o{ unit_attribute_values : "mendefinisikan"
    product_units ||--o{ unit_status_history : "riwayat"
    user ||--o{ unit_status_history : "mencatat"

    product_variants ||--o{ product_prices : "harga dasar"
    location |o--o{ product_prices : "konteks harga"
    product_units ||--o{ unit_price_adjustments : "penyesuaian"

    products ||--o{ product_media : "galeri"
    product_variants |o--o{ product_media : "galeri varian"
    product_units |o--o{ product_media : "galeri unit"

    company {
        uuid id PK
        varchar name
        varchar address "nullable"
    }
    user {
        uuid id PK
        uuid company_id FK
        varchar role "owner atau member"
    }
    location {
        uuid id PK
        uuid company_id FK
        uuid parent_id FK "nullable"
        varchar name
        varchar type "nullable, bebas"
    }
    product_categories {
        uuid id PK
        uuid company_id FK
        uuid parent_id FK "nullable"
        varchar code UK
        varchar name
        boolean is_active
    }
    units_of_measure {
        uuid id PK
        uuid company_id FK
        varchar code UK
        varchar name
    }
    products {
        uuid id PK
        uuid company_id FK
        uuid category_id FK
        uuid base_uom_id FK "wajib untuk QUANTITY"
        varchar code UK
        varchar name
        enum tracking_type "QUANTITY UNIT NONE"
        boolean is_active
    }
    product_variants {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        varchar code UK
        varchar name
        varchar sku UK "nullable"
        varchar barcode UK "nullable"
        boolean is_active
    }
    product_attributes {
        uuid id PK
        uuid company_id FK
        varchar code UK
        varchar name
        enum data_type "STRING NUMBER BOOLEAN DATE"
        varchar unit "nullable"
    }
    product_attribute_values {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        uuid variant_id FK "nullable"
        uuid attribute_id FK
        text value
    }
    inventory_balances {
        uuid id PK
        uuid company_id FK
        uuid variant_id FK
        uuid location_id FK
        int qty_on_hand
        int qty_reserved "0 sampai P2"
        int qty_allocated "0 sampai P2"
    }
    inventory_transactions {
        uuid id PK
        uuid company_id FK
        uuid variant_id FK
        uuid location_id FK
        enum transaction_type "IN OUT TRANSFER ADJUSTMENT OPNAME"
        uuid transfer_ref "nullable"
        int qty_delta
        int qty_before
        int qty_after
        text reason "wajib untuk ADJUSTMENT dan OPNAME"
        uuid actor_id FK
    }
    product_units {
        uuid id PK
        uuid company_id FK
        uuid variant_id FK
        uuid location_id FK
        varchar unit_code UK
        varchar serial_number UK "nullable"
        enum status "AVAILABLE RESERVED BOOKED SOLD BLOCKED"
    }
    characteristic_groups {
        uuid id PK
        uuid company_id FK
        varchar code UK
        varchar name
    }
    characteristics {
        uuid id PK
        uuid company_id FK
        uuid group_id FK
        varchar code
        varchar name
    }
    unit_characteristics {
        uuid id PK
        uuid company_id FK
        uuid product_unit_id FK
        uuid characteristic_id FK
    }
    unit_attribute_values {
        uuid id PK
        uuid company_id FK
        uuid product_unit_id FK
        uuid attribute_id FK
        text value
    }
    unit_status_history {
        uuid id PK
        uuid company_id FK
        uuid product_unit_id FK
        varchar from_status
        varchar to_status
        uuid from_location_id "nullable"
        uuid to_location_id "nullable"
        text reason "nullable"
        uuid actor_id FK
    }
    product_prices {
        uuid id PK
        uuid company_id FK
        uuid variant_id FK
        uuid location_id FK "nullable, null berarti default"
        decimal price "18,2"
        varchar currency "default IDR"
        date effective_date
        date end_date "nullable"
    }
    unit_price_adjustments {
        uuid id PK
        uuid company_id FK
        uuid product_unit_id FK
        decimal amount "boleh negatif"
        varchar reason "nullable"
        date effective_date
        date end_date "nullable"
    }
    product_media {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        uuid variant_id FK "nullable"
        uuid product_unit_id FK "nullable"
        enum media_type "IMAGE DOCUMENT VIDEO_LINK"
        varchar file_name "nullable"
        varchar file_url
        varchar file_type "nullable"
        int file_size "nullable"
        varchar title "nullable"
        int sort_order
        boolean is_primary
    }
```

Penanda `UK` berarti unik per company, kecuali `characteristics.code` yang unik per grup. Semua tabel di diagram selain `company` terhubung ke `company` lewat `company_id`, tetapi garisnya hanya digambar untuk empat tabel agar diagram tetap terbaca.

### Detail tabel

Semua tabel memiliki `id` (UUID), `company_id` (wajib, foreign key ke `company`), dan `created_at`. Tabel yang datanya bisa diubah juga memiliki `updated_at`. Kolom tersebut tidak diulang di bawah.

### Master data

**`product_categories`**: `parent_id` (nullable, tanpa siklus), `code` (unik per company), `name`, `sort_order`, `is_active`. Aturan hierarkinya ada di [Hierarki kategori dan lokasi](#hierarki-kategori-dan-lokasi).

**`units_of_measure`**: `code` (unik per company), `name`, `description` (nullable).

**`location`** dikembangkan dengan kolom berikut. Kolom yang sudah ada tetap.

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `parent_id` | UUID, nullable | Foreign key ke tabel ini. Tidak boleh membentuk siklus. |
| `type` | VARCHAR(30), nullable | Teks bebas per company, misalnya `WAREHOUSE`, `RACK`, `BIN`, `PROJECT`, `BLOCK`, `BRANCH` |

Kolom baru nullable agar lokasi yang sudah ada tetap valid.

**`product_attributes`**: spesifikasi produk atau varian. `code` (unik per company), `name`, `data_type` (`STRING`, `NUMBER`, `BOOLEAN`, `DATE`), `unit` (nullable), `is_active`.

**`characteristic_groups`**: `code` (unik per company), `name`, `is_active`. Contoh: Posisi, Kondisi, Warna.

**`characteristics`**: `group_id`, `code` (unik per grup), `name`, `is_active`. Contoh: Hook, Corner, Bekas.

### Katalog

**`products`**

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `category_id` | UUID | Foreign key ke `product_categories` |
| `base_uom_id` | UUID, nullable | Wajib untuk `QUANTITY` |
| `code` | VARCHAR(100) | Unik per company |
| `name` | VARCHAR(200) | |
| `tracking_type` | ENUM | `QUANTITY`, `UNIT`, `NONE`. Lihat keputusan 9. |
| `description` | TEXT, nullable | |
| `is_active` | BOOLEAN | Default true |

**`product_variants`**: `product_id`, `code` (unik per company), `name`, `sku` dan `barcode` (nullable, unik per company jika diisi), `is_active`.

**`product_attribute_values`**: `product_id`, `variant_id` (nullable, null berarti level produk), `attribute_id`, `value` (TEXT). Varian harus milik produk yang sama, dan `value` divalidasi sesuai `data_type`.

### Inventory kuantitas

**`inventory_balances`**

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `variant_id`, `location_id` | UUID | Unik bersama `company_id` |
| `qty_on_hand` | INT | Minimal 0 |
| `qty_reserved` | INT | Minimal 0. Selalu 0 sampai P2. |
| `qty_allocated` | INT | Minimal 0. Selalu 0 sampai P2. |

**`inventory_transactions`**: hanya bisa ditambah, tidak bisa diubah atau dihapus.

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `variant_id`, `location_id` | UUID | |
| `transaction_type` | ENUM | `IN`, `OUT`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`, `OPNAME` |
| `transfer_ref` | UUID, nullable | Menghubungkan kedua baris transfer |
| `qty_delta` | INT | |
| `qty_before`, `qty_after` | INT | Nilai `qty_on_hand` |
| `reference` | VARCHAR(100), nullable | |
| `reason` | TEXT, nullable | Wajib untuk `ADJUSTMENT` dan `OPNAME` |
| `actor_id` | UUID | Foreign key ke `user` |

Pencatatan transaksi dan riwayat status sudah berjalan sejak P1 karena wajib menurut aturan brief. Yang ditunda ke P2 hanya layar riwayat dan laporannya.

### Inventory unit

**`product_units`**: hanya untuk produk `tracking_type = UNIT`.

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `variant_id` | UUID | Foreign key ke `product_variants` |
| `location_id` | UUID | Foreign key ke `location` |
| `unit_code` | VARCHAR(100) | Unik per company |
| `serial_number` | VARCHAR(100), nullable | Unik per company jika diisi |
| `status` | ENUM | `AVAILABLE`, `RESERVED`, `BOOKED`, `SOLD`, `BLOCKED` |
| `notes` | TEXT, nullable | |

**`unit_characteristics`**: `product_unit_id`, `characteristic_id`. Kombinasinya unik.

**`unit_attribute_values`**: `product_unit_id`, `attribute_id`, `value`. Untuk nilai aktual per unit, misalnya luas tanah, nomor mesin, atau kapasitas.

**`unit_status_history`**: hanya bisa ditambah. `product_unit_id`, `from_status`, `to_status`, `from_location_id`, `to_location_id`, `reason`, `actor_id`.

### Harga

**`product_prices`**: harga dasar.

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `variant_id` | UUID | |
| `location_id` | UUID, nullable | Null berarti harga default. Jika diisi, berlaku untuk lokasi itu dan seluruh turunannya. |
| `price` | DECIMAL(18,2) | Tidak boleh negatif |
| `currency` | VARCHAR(10) | Default `IDR` |
| `effective_date` | DATE | |
| `end_date` | DATE, nullable | Tidak boleh sebelum `effective_date` |

**`unit_price_adjustments`**: penyesuaian per unit.

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `product_unit_id` | UUID | |
| `amount` | DECIMAL(18,2) | Boleh negatif |
| `reason` | VARCHAR(255), nullable | |
| `effective_date`, `end_date` | DATE | `end_date` nullable |

Harga tidak ditimpa. Revisi harga dibuat sebagai baris baru dengan periode baru. `price_log` dari ERD tidak dibuat karena tabel ini sudah menyimpan riwayatnya.

### Media

**`product_media`**: foto, dokumen, dan link video untuk produk, varian, atau unit.

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| `product_id` | UUID | Wajib |
| `variant_id` | UUID, nullable | Diisi jika media khusus varian. Harus milik `product_id`. |
| `product_unit_id` | UUID, nullable | Diisi jika media khusus unit. Unit harus milik varian dan produk yang sama. |
| `media_type` | ENUM | `IMAGE`, `DOCUMENT`, `VIDEO_LINK` |
| `file_name`, `file_type`, `file_size` | | Nullable. Diisi untuk file yang diunggah. |
| `file_url` | VARCHAR(500) | Path di `uploads` untuk file, atau URL untuk `VIDEO_LINK` |
| `title` | VARCHAR(150), nullable | Misalnya "Denah Type 36" |
| `sort_order` | INT | Default 0 |
| `is_primary` | BOOLEAN | Default false |

File diunggah lewat mekanisme yang sudah ada: disimpan di folder `uploads`, dibatasi 10 MB, dan hanya bisa dibuka user dari company yang sama.

### Perubahan tabel lain

- `viewing.slot_id` dihapus, karena `InventorySlot` dihapus dan tidak ada form yang mengisinya.
- `company` mendapat kolom `address` yang nullable.

## Aturan bisnis

### Hierarki kategori dan lokasi

- Jumlah level tidak ditentukan oleh struktur tabel, tetapi dibatasi paling dalam 5 level agar tampilan tetap terbaca.
- Level dihitung dari `parent_id` saat dibutuhkan, dan tidak disimpan.
- Induk harus milik company yang sama dan tidak boleh membentuk siklus.
- Produk boleh ditautkan ke kategori di level mana pun.
- Filter berdasarkan kategori atau lokasi ikut menyertakan seluruh turunannya. Memilih "Sembako" juga menampilkan produk di "Beras Premium".
- Untuk lokasi berlaku aturan tambahan: saldo dan unit hanya boleh berada di lokasi tanpa turunan.

### Nilai atribut

Atribut didefinisikan sekali di `product_attributes`, lalu nilainya diisi pada tingkat yang sesuai:

| Tingkat | Tabel | Dipakai untuk |
| --- | --- | --- |
| Produk | `product_attribute_values` dengan `variant_id` null | Nilai yang sama untuk semua varian |
| Varian | `product_attribute_values` dengan `variant_id` terisi | Nilai standar satu varian |
| Unit | `unit_attribute_values` | Nilai aktual satu unit yang berbeda dari standar |

Nilai yang ditampilkan untuk sebuah unit diambil dari tingkat paling spesifik yang terisi: unit, lalu varian, lalu produk. API dan layar unit juga menampilkan asal nilainya. Untuk produk `QUANTITY`, hanya tingkat produk dan varian yang dipakai.

Setiap atribut paling banyak punya satu nilai pada setiap tingkat. Artinya kombinasi produk, varian, dan atribut unik, begitu juga kombinasi unit dan atribut.

### Media

- Satu produk, varian, atau unit paling banyak punya satu media `is_primary`. Menandai media baru sebagai utama melepas tanda pada media sebelumnya dalam satu transaksi.
- `IMAGE` hanya menerima JPEG, PNG, dan WebP. `DOCUMENT` hanya menerima PDF.
- `VIDEO_LINK` harus berupa URL `https`.
- Menghapus media juga menghapus filenya dari `uploads`.

### Availability

| Metode | Perhitungan |
| --- | --- |
| Kuantitas | `qty_on_hand - qty_reserved - qty_allocated` per varian dan lokasi |
| Unit | Jumlah unit berstatus `AVAILABLE`. Status lain tidak dihitung. |
| Tanpa pelacakan | Tidak punya stok, sehingga tidak dihitung |

Availability dihitung saat dibaca dan tidak disimpan. Availability pada lokasi induk adalah jumlah dari seluruh lokasi turunannya.

### Inventory kuantitas

- Saldo hanya disimpan di lokasi paling spesifik, yaitu lokasi tanpa turunan.
- Lokasi yang menyimpan saldo atau unit tidak bisa diberi lokasi turunan.
- Stock out dan transfer tidak boleh melebihi availability.
- Transfer mengurangi lokasi asal dan menambah lokasi tujuan dalam satu transaksi database.
- Adjustment dan opname wajib punya alasan. Opname mencatat selisih antara hitungan fisik dan saldo.
- Setiap perubahan saldo menghasilkan record transaksi dalam transaksi database yang sama.
- Perubahan saldo memakai update bersyarat, sehingga dua permintaan bersamaan tidak bisa membuat stok negatif.

### Inventory unit

- Kode unit unik per company. Registrasi massal bisa membuat kode dari prefix dan nomor urut, dan seluruhnya gagal jika ada kode yang bentrok.
- Status awal unit adalah `AVAILABLE`.
- Selama reservasi belum ada, transisi manual di P1:

| Dari | Ke |
| --- | --- |
| `AVAILABLE` | `BLOCKED`, `SOLD` |
| `BLOCKED` | `AVAILABLE` |

- `RESERVED` dan `BOOKED` hanya akan diisi alur reservasi di P2. `SOLD` bersifat final, dan tidak ada transisi keluar darinya.
- Setiap perubahan status atau lokasi mencatat `unit_status_history`.
- Unit yang sudah `SOLD` tidak bisa dipindah atau dihapus.

### Pemilihan harga

Harga dasar diambil dari baris yang periodenya mencakup tanggal acuan, dengan urutan:

1. Harga pada lokasi barang, lalu naik ke lokasi induknya satu per satu.
2. Harga default varian (`location_id` null).

Untuk unit, harga akhir = harga dasar + penyesuaian yang berlaku. Contoh: harga dasar 350 juta + penyesuaian 25 juta = 375 juta. Hasil akhir tidak boleh negatif.

Jika harga dasar tidak ditemukan, API mengembalikan error yang jelas, bukan harga 0. Dua periode tumpang tindih pada kombinasi yang sama ditolak. MySQL tidak punya constraint untuk rentang tanggal, sehingga pengecekan dilakukan di dalam transaksi.

### Keamanan dan validasi

- `company_id` dan aktor selalu diambil dari JWT, tidak pernah dari body.
- Setiap ID relasi divalidasi milik company yang sama sebelum dipakai.
- Hanya produk `UNIT` yang boleh punya unit, dan hanya produk `QUANTITY` yang boleh punya saldo.
- Master yang sudah dipakai dinonaktifkan, tidak dihapus.

## API

Semua endpoint berada di `/api` dan membutuhkan autentikasi.

| Resource | Endpoint |
| --- | --- |
| Master | CRUD `/product-categories`, `/units-of-measure`, `/product-attributes`, `/characteristic-groups`, `/characteristics` |
| Produk | CRUD `/products`, `/products/:id/variants` |
| Inventory kuantitas | `GET /inventory/balances`, `GET /inventory/transactions`, `POST /inventory/stock-in`, `/stock-out`, `/transfers`, `/adjustments`, `/opnames` |
| Unit | CRUD `/product-units`, `POST /product-units/bulk`, `POST /product-units/:id/status`, `POST /product-units/:id/move` |
| Availability | `GET /availability?productId&variantId&locationId&status` |
| Harga | CRUD `/product-prices`, `/unit-price-adjustments`, `GET /product-prices/resolve?variantId&unitId&locationId&date` |
| Media | `GET /products/:id/media`, `POST /products/:id/media` (file atau link), `PATCH /product-media/:id`, `DELETE /product-media/:id` |

## Frontend

Mengikuti pola yang ada: TanStack Query, React Hook Form, Zod, dan komponen `components/ui`. Modul mengikuti navigasi brief, dengan nama yang netral dari industri.

- **Master Data:** kategori, satuan, hierarki lokasi, atribut, karakteristik.
- **Products:** `/products`, `/products/[id]`, dengan varian, atribut, dan galeri media.
- **Inventory:** `/inventory/quantity` untuk saldo dan transaksi, `/inventory/units` untuk daftar, registrasi, dan status.
- **Availability:** `/availability`, dengan filter produk, lokasi, dan status.
- **Pricing:** `/pricing`, dengan harga dasar, penyesuaian unit, dan alat cek harga.

Form produk menampilkan isian sesuai `tracking_type`. Setiap layar menangani kondisi loading, kosong, sukses, gagal validasi, tidak berwenang, dan error.

## Pengujian

- Unit test harga: setiap tingkat lokasi, periode, overlap, tidak ada harga, dan penyesuaian.
- Unit test inventory: semua jenis transaksi, stok tidak cukup, alasan wajib, dan aturan lokasi.
- Unit test status: transisi valid dan tidak valid, serta riwayat tercatat.
- Unit test atribut: nilai unit menggantikan nilai varian, nilai varian menggantikan nilai produk, dan validasi `data_type`.
- Unit test hierarki: batas 5 level, siklus, dan filter yang menyertakan turunan.
- Unit test media: satu media utama, tipe file yang ditolak, link non-`https` ditolak, dan file ikut terhapus.
- Isolasi company: ID milik company lain ditolak di setiap endpoint.
- Konkurensi: dua stock out bersamaan pada stok terakhir, diuji dengan database sungguhan.
- Migrasi: dijalankan pada database kosong dan salinan database dev.

Skenario validasi browser, untuk membuktikan model yang sama melayani kedua bisnis tanpa kode khusus:

- **Trading:** Beras 5 kg, lokasi Warehouse A > Rak 01 > Bin 01, stok awal 500 pcs, lalu stock in, stock out, transfer, dan adjustment.
- **Properti:** dua proyek dengan masing-masing dua blok, satu tipe rumah dipakai bersama, harga berbeda per proyek, dan unit hook dengan penyesuaian harga.

Bagian "reserved quantity" pada skenario brief divalidasi saat P2.

## Contoh data

ID ditulis angka agar mudah dibaca. Aslinya UUID, dan setiap baris punya `company_id`. Contoh yang sama ada di gambar ERD.

### Skenario A: Trading

**`product_categories`**

| id | parent_id | name |
| --- | --- | --- |
| 1 | NULL | Sembako |
| 2 | 1 | Beras |
| 3 | 2 | Beras Premium |
| 4 | 1 | Minyak |

**`location`**

| id | parent_id | name | type |
| --- | --- | --- | --- |
| 1 | NULL | Gudang A | WAREHOUSE |
| 2 | 1 | Rak 01 | RACK |
| 3 | 2 | Bin 01 | BIN |

**`products`** dan **`product_variants`**

| Produk | category_id | tracking_type | base_uom | Varian |
| --- | --- | --- | --- | --- |
| Beras | 3 (Beras Premium) | QUANTITY | PCS | 5 kg (`BRS-5KG`) |
| Minyak | 4 | QUANTITY | PCS | 1 L (`MYK-1L`) |

**`product_attributes`** dan **`product_attribute_values`**

| Atribut | data_type | unit | Tingkat | Nilai |
| --- | --- | --- | --- | --- |
| Merek | STRING | | Produk Beras | Rojolele |
| Berat Bersih | NUMBER | kg | Varian 5 kg | 5 |

**`inventory_balances`**: varian 5 kg di Bin 01, `qty_on_hand` 500, `qty_reserved` 0, `qty_allocated` 0. Availability = 500 pcs.

**`product_prices`**: varian 5 kg, `location_id` NULL, 120.000, berlaku mulai 2026-01-01.

**`product_media`**: foto kemasan Beras sebagai media utama produk.

### Skenario B: Properti

**`location`**

| id | parent_id | name | type |
| --- | --- | --- | --- |
| 10 | NULL | Green Residence | PROJECT |
| 11 | 10 | Block A | BLOCK |
| 12 | 10 | Block B | BLOCK |
| 20 | NULL | Grand Harmoni | PROJECT |
| 21 | 20 | Block A | BLOCK |
| 22 | 20 | Block B | BLOCK |

**`products`**: Rumah Tapak, `tracking_type` UNIT, dengan varian Type 36 (`T36`) dan Type 45 (`T45`).

**`product_attributes`**

| code | name | data_type | unit |
| --- | --- | --- | --- |
| LT | Luas Tanah | NUMBER | m² |
| LB | Luas Bangunan | NUMBER | m² |
| KT | Kamar Tidur | NUMBER | |
| SRT | Sertifikat | STRING | |

**`product_attribute_values`**

| Tingkat | Atribut | Nilai |
| --- | --- | --- |
| Produk Rumah Tapak | Sertifikat | SHM |
| Varian Type 36 | Luas Tanah | 72 |
| Varian Type 36 | Luas Bangunan | 36 |
| Varian Type 36 | Kamar Tidur | 2 |
| Varian Type 45 | Luas Tanah | 90 |
| Varian Type 45 | Luas Bangunan | 45 |
| Varian Type 45 | Kamar Tidur | 3 |

**`characteristics`**: grup Posisi berisi Standard, Hook, dan Corner.

**`product_units`**

| unit_code | Varian | Lokasi | status | Karakteristik |
| --- | --- | --- | --- | --- |
| GR-A01 | Type 36 | Green Residence > Block A | AVAILABLE | Standard |
| GR-A02 | Type 45 | Green Residence > Block A | AVAILABLE | Standard |
| GR-A03 | Type 36 | Green Residence > Block A | AVAILABLE | Hook |
| GH-B01 | Type 45 | Grand Harmoni > Block B | BLOCKED | Corner |
| GH-B02 | Type 36 | Grand Harmoni > Block B | SOLD | Standard |

**`unit_attribute_values`**: GR-A03, Luas Tanah 100. Unit lain tidak punya baris di tabel ini karena sama dengan standar variannya.

**`product_prices`**

| Varian | Lokasi | Harga |
| --- | --- | --- |
| Type 36 | Green Residence | 350.000.000 |
| Type 36 | Grand Harmoni | 310.000.000 |
| Type 45 | NULL (default) | 450.000.000 |

**`unit_price_adjustments`**: GR-A03, +25.000.000, alasan posisi hook.

**`product_media`**

| Ditautkan ke | media_type | title | is_primary |
| --- | --- | --- | --- |
| Produk Rumah Tapak | IMAGE | Tampak depan | true |
| Varian Type 36 | DOCUMENT | Denah Type 36 | false |
| Varian Type 36 | VIDEO_LINK | Video tur Type 36 | false |
| Unit GR-A03 | IMAGE | Progres pembangunan | true |

**Hasil yang dilihat sales untuk Type 36 di Green Residence:**

| Unit | Luas Tanah | Asal nilai | Harga akhir | Status |
| --- | --- | --- | --- | --- |
| GR-A01 | 72 m² | Varian | 350.000.000 | AVAILABLE |
| GR-A03 | 100 m² | Unit | 375.000.000 | AVAILABLE |

Harga GR-A03 diambil dari Block A, naik ke induknya Green Residence (350 juta), lalu ditambah penyesuaian 25 juta. Availability Type 36 di Green Residence adalah 2 unit.

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Tabel lama ternyata berisi data | Hitung baris di setiap environment sebelum migrasi |
| Migrasi rename dibuat Prisma sebagai drop dan create | Review SQL dan tulis `RENAME` secara manual |
| `Company` tertukar dengan `Organization` | Label UI yang jelas. `Organization` berarti perusahaan pelanggan. |
| Perubahan saldo melewati aturan | Saldo hanya berubah lewat use case inventory, dan route generik dihapus |
| Saldo berbeda dari riwayat | Tulis keduanya dalam satu transaksi, dan sediakan query rekonsiliasi |
| Istilah satu industri masuk ke UI atau kode | Review label, dan uji dengan kedua skenario |

## Untuk dikonfirmasi saat P2

Tiga hal ini ada di brief dan tidak memengaruhi P1, tetapi perlu dijawab sebelum P2:

1. Diagram 3 dan 5 membuat availability turun dua kali saat stok yang direservasi dialokasikan. Reservasi 20 lalu alokasi 20 mengurangi 40. Usulan: `qty_reserved` turun saat alokasi.
2. Diagram 4 mengarahkan unit yang batal ke `Reserved` atau `Blocked`, sedangkan Diagram 5 menyebut unit dilepas. Usulan: kembali ke `AVAILABLE`.
3. Reservasi memakai `Customer` yang ada dan bisa ditautkan ke `Deal` secara opsional.

## Keputusan P1 yang sudah disepakati

1. Keputusan 4, 5, dan 10 dipakai. Pembuat dokumen `Universal_Product_Master` tetap perlu diberi tahu karena ketiganya berbeda dari dokumennya.
2. Transisi manual `AVAILABLE` ke `SOLD` dibolehkan di P1, karena reservasi belum ada.
3. Impor unit dari file tidak termasuk P1. P1 cukup input manual dan registrasi massal dengan prefix.
