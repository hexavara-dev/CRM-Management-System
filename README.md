# Hexavara CRM

**Aplikasi CRM multi-tenant** untuk membantu tim sales mengelola prospek, deal, jadwal kunjungan, dan tugas tindak lanjut dalam satu tempat. Dibangun dengan Next.js, Express, Prisma, dan MySQL.

Hexavara CRM ditujukan untuk perusahaan konstruksi dan bisnis kecil yang masih mencatat hubungan pelanggan di spreadsheet atau alat yang terpisah-pisah. Setiap perusahaan punya data sendiri yang terisolasi dari perusahaan lain.

## Fitur Utama

- **Dashboard:** statistik penjualan dan aktivitas terbaru.
- **Leads:** pengelolaan prospek, pipeline kanban, dan konversi lead menjadi deal.
- **Deals:** pengelolaan nilai, tahap, status, dan target penutupan deal.
- **Organisasi:** data perusahaan pelanggan.
- **Kunjungan:** penjadwalan kunjungan ke prospek.
- **Notes dan Tasks:** catatan serta tugas tindak lanjut.
- **Lampiran:** unggah PDF, JPEG, PNG, atau WebP hingga 10 MB.
- **Tim dan pengaturan:** undangan anggota tim serta pengaturan tahap dan status.
- **Multi-tenant:** login berbasis JWT, dan data setiap perusahaan dibatasi pada tenant-nya.

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

Siapkan database MySQL 8.0, baik manual maupun lewat Docker:

```bash
# Manual: jalankan di MySQL yang sudah terpasang
mysql -u root -p -e "CREATE DATABASE crm_engine"

# Atau lewat Docker
cp .env.example .env
docker compose up -d db
```

Siapkan backend:

```bash
cd backend
npm install
```

Salin konfigurasi, lalu ganti `JWT_SECRET` dengan nilai acak. Untuk MySQL manual, sesuaikan juga user dan password di `DATABASE_URL`:

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
