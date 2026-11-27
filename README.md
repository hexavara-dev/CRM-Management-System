# Hexavara CRM

**Aplikasi CRM multi-tenant untuk developer properti.** Hexavara CRM membantu tim sales mengelola project, stok unit, harga, prospek, kunjungan, reservasi, dan deal dalam satu tempat. Dibangun dengan Next.js, Express, Prisma, dan MySQL.

Setiap perusahaan punya data sendiri yang terisolasi dari perusahaan lain.

## Fitur Utama

- **Dashboard:** statistik penjualan dan aktivitas terbaru.
- **Product Management:**
  - Project dengan hierarki lokasi bebas (cluster, zona, blok, tower, lantai).
  - Tipe unit beserta varian, spesifikasi, dan foto.
  - Siteplan dan fasilitas project.
  - Unit per lokasi, termasuk tanda "sudah terjual" untuk data awal project yang sudah berjalan.
- **Availability & Reservation:** ketersediaan unit per lokasi, reservasi dengan batas waktu, dan status unit yang mengikuti reservasi atau deal.
- **Pricing Management:** harga jual per unit dengan riwayat perubahan. Harga dasar varian menjadi batas bawah.
- **Leads Management:** daftar dan pipeline lead, label, sumber, aktivitas, jadwal kunjungan (viewing), serta arsip lead.
- **Deals Management:** buat deal dari lead dengan dokumen persyaratan per jenis pembayaran (Tunai, KPR, KPR Syariah), bank pembiayaan, pipeline deal, dan detail transaksi.
- **CRM Configuration:** label, form template, pipeline leads dan deals, sumber, serta jenis aktivitas lead.
- **Tim:** undangan anggota tim dengan peran owner, admin, atau member.
- **Lampiran:** unggah PDF, JPEG, PNG, atau WebP hingga 10 MB.
- **Multi-tenant:** login berbasis JWT, dan semua data dibatasi pada tenant pengguna.

## Environment

| Environment | URL | Deploy |
| --- | --- | --- |
| Staging | https://crm.hexavara.com | Manual dari branch mana pun |
| Production | https://ampro.hexavara.com | Manual, hanya dari `main` |

Detail deploy, konfigurasi server, dan langkah transisi ada di [CI dan Deploy](docs/CI_CD.md).

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, TanStack Query, React Hook Form, Zod, Tailwind CSS 4 |
| Backend | Express 5, TypeScript, Prisma 7, JWT, Multer, Jest |
| Database | MySQL 8.0 |
| Infrastruktur | Docker Compose, GitHub Actions |

## Dokumentasi

- [Panduan Instalasi](docs/INSTALLATION.md)
- [CI dan Deploy](docs/CI_CD.md)

## Mulai Cepat

Siapkan database MySQL 8.0:

```bash
mysql -u root -p -e "CREATE DATABASE crm_engine"
```

Siapkan backend:

```bash
cd backend
npm install
```

Salin konfigurasi, lalu ganti `JWT_SECRET` dengan nilai acak. Sesuaikan juga user dan password di `DATABASE_URL`:

```bash
cp .env.example .env
```

Lalu terapkan migrasi dan jalankan API:

```bash
npx prisma migrate deploy
npm run dev
```

Pada terminal lain, jalankan frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev -- -p 3001
```

Aplikasi dapat diakses melalui `http://localhost:3001`.

Buat akun pertama di `http://localhost:3001/register`. Detail konfigurasi dan troubleshooting tersedia pada [Panduan Instalasi](docs/INSTALLATION.md).
