# Panduan Instalasi

Lokal dan server memakai konfigurasi yang berbeda:

- [Instalasi lokal](#instalasi-lokal): manual tanpa Docker, memakai `backend/.env` dan `frontend/.env.local`.
- [Docker di lokal](#docker-di-lokal): semua service lewat Docker, memakai `.env` di root dari `.env.local.example`.
- [Deploy ke server](#deploy-ke-server-dengan-docker): dengan Docker, hanya memakai `.env` di root project.

| Bagian | Teknologi | Alamat lokal |
| --- | --- | --- |
| Frontend | Next.js 16, React 19 | http://localhost:3001 |
| Backend | Express 5, Prisma 7 | http://localhost:3000 |
| Database | MySQL 8.0 | `localhost:3306` |

## Prasyarat lokal

- Node.js 20 (versi yang dipakai Dockerfile dan CI) dan npm. Gunakan npm, bukan pnpm, karena Dockerfile dan CI memakai `package-lock.json`.
- MySQL 8.0 yang terpasang di komputer, misalnya lewat Laragon.
- Git.

Port 3000, 3001, dan 3306 harus kosong.

## Instalasi lokal

Perintah di bawah bisa dijalankan di PowerShell maupun Bash, kecuali yang diberi keterangan.

### 1. Ambil kode

```bash
git clone https://github.com/hexavara-dev/CRM-Management-System.git
cd CRM-Management-System
```

### 2. Siapkan database

Pastikan service MySQL 8.0 sudah berjalan, lalu masuk ke MySQL:

```bash
mysql -u root -p
```

Buat database:

```sql
CREATE DATABASE crm_engine;
EXIT;
```

Pada langkah 3, sesuaikan `DATABASE_URL` di `backend/.env` dengan user, password, dan port MySQL Anda:

```env
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/crm_engine
```

Jika password mengandung karakter khusus seperti `@`, `:`, atau `/`, tulis dalam bentuk URL-encoded. Misalnya, `@` menjadi `%40`.

Bawaan Laragon memakai user `root` tanpa password, sehingga nilainya `mysql://root@localhost:3306/crm_engine`.

### 3. Siapkan backend

```bash
cd backend
npm install
```

Salin contoh konfigurasinya. Backend hanya membaca `.env`, bukan `.env.development`.

```bash
cp .env.example .env
```

Di PowerShell, gunakan `Copy-Item .env.example .env`. Lalu ganti `JWT_SECRET` dengan nilai acak.

| Variabel | Wajib | Fungsi |
| --- | --- | --- |
| `DATABASE_URL` | Ya | Koneksi MySQL. Backend berhenti saat start jika kosong. |
| `JWT_SECRET` | Ya | Kunci penanda token login. |
| `ALLOW_PUBLIC_REGISTRATION` | Tidak | Set `true` untuk membuka `/register`. Selain itu, pendaftaran ditutup. |
| `PORT` | Tidak | Port API. Default `3000`. |
| `CORS_ORIGINS` | Tidak | Origin frontend, dipisah koma. Default `http://localhost:3001`. |
| `DEV_BASE_URL` | Tidak | URL dasar untuk tautan file upload. Default `http://localhost:3000`. |

Buat nilai acak untuk `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Terapkan migrasi, lalu jalankan API:

```bash
npx prisma migrate deploy
npm run dev
```

Biarkan terminal ini tetap terbuka. Cek dari terminal lain:

```bash
curl http://localhost:3000/health
```

Hasil yang benar berisi `"status":"ok"`.

> Di PowerShell 5.1, `curl` adalah alias `Invoke-WebRequest`. Gunakan `curl.exe`, atau buka alamatnya di browser.

### 4. Siapkan frontend

Di terminal baru, dari root project:

```bash
cd frontend
npm install
```

Salin konfigurasinya:

```bash
cp .env.example .env.local
```

Di PowerShell, gunakan `Copy-Item .env.example .env.local`.

Jalankan di port 3001. Port ini wajib karena port 3000 dipakai API, dan CORS bawaan backend hanya mengizinkan `http://localhost:3001`.

```bash
npm run dev -- -p 3001
```

Script `dev` dan `build` sudah memakai Webpack, karena binding native Next SWC/Turbopack bisa gagal di Windows.

### 5. Buat akun pertama

Project ini tidak membutuhkan seeder. Buka http://localhost:3001/register, lalu isi nama organisasi, nama, email, dan password. Status bawaan organisasi dibuat otomatis, dan Anda langsung masuk sebagai `owner`.

Halaman ini hanya berfungsi jika `ALLOW_PUBLIC_REGISTRATION=true`. Nilai tersebut sudah ada di `.env.example`.

### 6. Isi akun demo (opsional)

Seeder membuat satu organisasi demo dengan satu akun untuk setiap role. Jalankan dari folder `backend`:

```bash
npm run db:seed
```

| Role | Email | Password |
| --- | --- | --- |
| `owner` | `owner@example.com` | `password123` |
| `member` | `member@example.com` | `password123` |

Seeder aman dijalankan berulang karena akun yang sudah ada dilewati dan passwordnya tidak diubah. Seeder menolak berjalan jika `NODE_ENV=production`.

## Docker di lokal

Salin konfigurasi lokal, lalu jalankan semua service:

```bash
cp .env.local.example .env
docker compose up --build -d
```

Di PowerShell, gunakan `Copy-Item .env.local.example .env` untuk baris pertama. Port 3000 dan 3001 harus kosong. Aplikasi terbuka di http://localhost:3001, dan MySQL terbuka di `localhost:3307`.

Untuk mengisi akun demo, jalankan dari folder `backend` setelah `npm install`:

```bash
DATABASE_URL=mysql://root:password@localhost:3307/crm_engine npm run db:seed
```

Di PowerShell, jalankan `$env:DATABASE_URL="mysql://root:password@localhost:3307/crm_engine"; npm run db:seed`, lalu tutup terminalnya agar nilai itu tidak terpakai perintah lain.

## Deploy ke server dengan Docker

Bagian ini menjelaskan konfigurasinya. Untuk deploy lewat GitHub Actions, lihat [CI_CD.md](CI_CD.md).

Server hanya membutuhkan Docker dengan Compose dan reverse proxy HTTPS. File `backend/.env` dan `frontend/.env.local` tidak dipakai di sini.

Salin konfigurasi, lalu ganti semua nilainya:

```bash
cp .env.example .env
chmod 600 .env
```

| Variabel | Fungsi |
| --- | --- |
| `DB_PASSWORD` | Password root MySQL di dalam Docker |
| `JWT_SECRET` | Kunci penanda token login |
| `ALLOW_PUBLIC_REGISTRATION` | Set `true` hanya saat membuat akun pertama |
| `CORS_ORIGINS` | Domain frontend |
| `API_URL` | URL publik API. Dipakai saat build frontend. |

Jalankan semua service:

```bash
docker compose up --build -d
```

Backend menerapkan migrasi otomatis saat start. Seeder tidak pernah dijalankan di server.

Frontend, API, dan MySQL hanya terbuka di `127.0.0.1`, masing-masing di port 3001, 3000, dan 3307, sehingga tidak bisa diakses langsung dari internet. Arahkan reverse proxy HTTPS ke port frontend dan API. HTTPS wajib karena cookie login memakai atribut `Secure` di production.

Untuk membuat akun pertama, set `ALLOW_PUBLIC_REGISTRATION=true`, jalankan `docker compose up -d backend`, daftar di `/register`, lalu kembalikan ke `false` dan jalankan perintah yang sama.

| Perintah | Fungsi |
| --- | --- |
| `docker compose logs -f backend` | Melihat log API |
| `docker compose down` | Menghentikan service, data tetap tersimpan |

## Perintah harian

| Lokasi | Perintah | Fungsi |
| --- | --- | --- |
| `backend` | `npm run dev` | API dengan auto-reload |
| `backend` | `npm test -- --runInBand` | Menjalankan test |
| `backend` | `npm run build` | Kompilasi TypeScript ke `dist` |
| `backend` | `npm run migrate:dev` | Membuat dan menerapkan migrasi baru |
| `backend` | `npx prisma studio` | Melihat isi database |
| `frontend` | `npm run dev -- -p 3001` | Dev server |
| `frontend` | `npx tsc --noEmit` | Pemeriksaan tipe |
| `frontend` | `npm run build` | Build produksi |

Test backend membutuhkan `DATABASE_URL` dan `JWT_SECRET` dari `backend/.env`, tetapi tidak perlu database yang menyala.

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
| --- | --- |
| `Missing database URL. Set DATABASE_URL in .env.` | `backend/.env` belum dibuat atau dijalankan dari folder lain. |
| `Missing JWT_SECRET environment variable` | Tambahkan `JWT_SECRET` ke `backend/.env`. |
| Prisma gagal terhubung ke database | Pastikan MySQL menyala dan database `crm_engine` sudah ada. Cek user, password, dan port di `DATABASE_URL`. |
| Browser menampilkan error CORS | Pastikan frontend dibuka di port 3001, atau tambahkan origin-nya ke `CORS_ORIGINS`. |
| `EADDRINUSE` atau port sudah dipakai | Hentikan aplikasi yang memakai port tersebut. Jika port API diubah, sesuaikan `NEXT_PUBLIC_API_URL_DEV` dan `DEV_BASE_URL`. |
| Perubahan `NEXT_PUBLIC_API_URL_DEV` tidak terbaca | Restart dev server. Pada Docker, build ulang image frontend. |
| `/register` menampilkan `Public registration is disabled` | Set `ALLOW_PUBLIC_REGISTRATION=true`, lalu restart backend. |
| `docker compose` gagal dengan pesan `Set ...` | Di server, buat file `.env` di root dari `.env.example` dan isi semua nilainya. |

Untuk CI dan deploy, lihat [CI_CD.md](CI_CD.md).
