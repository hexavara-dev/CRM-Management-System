# CI dan Deploy

Ada dua workflow GitHub Actions di `.github/workflows`.

## CI (`ci.yml`)

Berjalan otomatis pada pull request ke `main` dan push ke `main`.

| Job | Langkah |
| --- | --- |
| Backend | `npm ci`, ESLint, build, `prisma migrate deploy` ke MySQL baru, test |
| Frontend | `npm ci`, Biome, `tsc --noEmit`, build |

## Deploy (`deploy.yml`)

Deploy hanya berjalan manual dan tidak pernah otomatis saat push. Alurnya:

1. Menjalankan CI, kecuali `skip_tests` dicentang untuk hotfix.
2. Mengirim kode dari commit yang dipilih ke VPS lewat SSH, ke `/var/www/<APP_NAME>/releases/<timestamp>`.
3. Di server: menjalankan `docker compose up --build -d` dengan konfigurasi `/var/www/<APP_NAME>/.env`, lalu mengarahkan symlink `current` ke release baru.
4. Backend menerapkan migrasi saat start.
5. Mengecek `/health`, lalu menyimpan 5 release terakhir.

Migrasi tidak ikut dibatalkan jika deploy gagal setelahnya. Pastikan migrasi kompatibel dengan versi sebelumnya.

### Menjalankan deploy

Buka tab **Actions**, pilih **Deploy to VPS**, klik **Run workflow**, lalu pilih branch dan environment. Sebaiknya aktifkan **Required reviewers** pada environment `production`.

Staging boleh di-deploy dari branch mana pun untuk uji coba. Production hanya bisa dari `main`; workflow berhenti jika branch lain dipilih.

### Environment

Staging dan production berjalan di VPS yang sama, masing-masing dengan folder, project Docker Compose, database, dan port sendiri.

| | Staging | Production |
| --- | --- | --- |
| Domain | `crm.hexavara.com` | `ampro.hexavara.com` |
| GitHub Environment | `staging` | `production` |
| `APP_NAME` | nama yang sudah dipakai `crm.hexavara.com` (lihat [Transisi](#transisi-crmhexavaracom-menjadi-staging)) | `crm-production` |
| Folder server | `/var/www/<APP_NAME staging>` | `/var/www/crm-production` |
| `API_PORT` / `WEB_PORT` / `DB_PORT` | `3000` / `3001` / `3307` | `3010` / `3011` / `3317` |
| `CORS_ORIGINS` dan `API_URL` | `https://crm.hexavara.com` | `https://ampro.hexavara.com` |

### Konfigurasi GitHub

Buat environment `staging` dan `production` di **Settings > Environments**, lalu isi nilai berikut pada masing-masing environment.

| Jenis | Nama | Isi |
| --- | --- | --- |
| Secret | `SSH_PRIVATE_KEY` | Private key khusus deploy |
| Secret | `VPS_HOST` | Host atau IP server |
| Secret | `VPS_USER` | User SSH di server |
| Variable | `APP_NAME` | Nama aplikasi, misalnya `crm-staging`. Hanya huruf kecil, angka, dan tanda hubung. |
| Variable | `APP_DOMAIN` | Domain frontend |

Konfigurasi aplikasi tidak disimpan di GitHub, melainkan di file `.env` pada server.

### Persiapan server (sekali saja)

Server membutuhkan Docker dengan Compose, dan `VPS_USER` harus bisa menjalankan `docker` tanpa `sudo`. Sediakan juga reverse proxy dengan HTTPS, yang tidak diatur oleh workflow ini. Contoh Nginx ada di [Reverse proxy](#reverse-proxy).

HTTPS wajib karena cookie login memakai atribut `Secure`.

```bash
sudo mkdir -p /var/www/<APP_NAME>
sudo chown -R <VPS_USER> /var/www/<APP_NAME>
nano /var/www/<APP_NAME>/.env
chmod 600 /var/www/<APP_NAME>/.env
```

Isi `.env` mengikuti [`.env.example`](../.env.example). Penjelasan tiap variabelnya ada di [panduan instalasi](INSTALLATION.md#deploy-ke-server-dengan-docker).

Beberapa environment bisa berjalan di satu server. Nama container mengikuti `APP_NAME`, dan port host diatur lewat `API_PORT`, `WEB_PORT`, dan `DB_PORT` di `.env`. Pastikan port tiap environment berbeda (lihat tabel [Environment](#environment)).

Workflow tidak menghapus image Docker lama, karena server bisa dipakai aplikasi lain. Periksa pemakaian disk sesekali dengan `docker system df`, dan hapus image lama project ini secara manual.

### Reverse proxy

Frontend dan API cukup memakai satu subdomain. Nginx meneruskan `/api` dan `/uploads` ke backend, dan sisanya ke frontend. Isi `CORS_ORIGINS` dan `API_URL` di `.env` server dengan alamat yang sama.

Setiap environment punya satu site Nginx. Contoh di bawah untuk staging (`crm.hexavara.com`, port `3000`/`3001`). Untuk production, buat `/etc/nginx/sites-available/ampro.hexavara.com` dengan `server_name ampro.hexavara.com` dan port `3010`/`3011`.

Buat `/etc/nginx/sites-available/crm.hexavara.com`:

```nginx
server {
    listen 80;
    server_name crm.hexavara.com;
    client_max_body_size 20m;

    location ~ ^/(api|uploads)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Setelah DNS mengarah ke server, aktifkan site dan pasang sertifikat:

```bash
ln -s /etc/nginx/sites-available/crm.hexavara.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d crm.hexavara.com
```

Sampai deploy pertama selesai, domain ini menampilkan 502.

### Transisi: crm.hexavara.com menjadi staging

Sebelumnya `crm.hexavara.com` adalah production. Datanya dipertahankan sebagai data staging, dan `ampro.hexavara.com` menjadi production baru dengan database kosong.

1. **Catat `APP_NAME` lama.** Lihat variable `APP_NAME` di GitHub Environment `production` yang sekarang (atau nama folder di `/var/www`). Volume database dan upload mengikuti nama ini, jadi staging harus tetap memakainya.
2. **Atur GitHub Environment `staging`:** `APP_NAME` = nama lama tersebut, `APP_DOMAIN` = `crm.hexavara.com`, serta secret SSH dan VPS yang sama.
3. **Lengkapi `.env` staging** di `/var/www/<APP_NAME lama>/.env` dengan `API_PORT=3000`, `WEB_PORT=3001`, `DB_PORT=3307`. Nilai lain tetap.
4. **Deploy staging** dari `main`. Container dibuat ulang dengan nama baru yang mengikuti `APP_NAME`, sedangkan volume dan datanya tetap.
5. **Siapkan production** mengikuti [Persiapan server](#persiapan-server-sekali-saja) dengan `APP_NAME=crm-production`. Isi `.env`-nya dengan `DB_PASSWORD` dan `JWT_SECRET` baru (jangan sama dengan staging), `CORS_ORIGINS` dan `API_URL` = `https://ampro.hexavara.com`, serta `API_PORT=3010`, `WEB_PORT=3011`, `DB_PORT=3317`.
6. **Ubah GitHub Environment `production`:** `APP_NAME` = `crm-production`, `APP_DOMAIN` = `ampro.hexavara.com`. Aktifkan **Required reviewers**.
7. **Pasang Nginx dan sertifikat** untuk `ampro.hexavara.com` (port `3010`/`3011`), lalu deploy production dari `main`.
8. **Buat akun pertama** production mengikuti [Akun pertama](#akun-pertama).

Lakukan langkah 2 sampai 4 sebelum langkah 6. Jika `production` diubah lebih dulu, deploy berikutnya ke `crm.hexavara.com` akan memakai `APP_NAME` baru dan database kosong.

### Akun pertama

Set `ALLOW_PUBLIC_REGISTRATION=true` di `.env`, lalu jalankan perintah ini agar nilainya terbaca:

```bash
cd /var/www/<APP_NAME>/current
docker compose -p <APP_NAME> --env-file /var/www/<APP_NAME>/.env up -d backend
```

Daftar di `/register`, kembalikan nilainya ke `false`, lalu jalankan perintah yang sama.

### Rollback

Masuk ke server, lalu jalankan release sebelumnya. Rollback ini tidak membatalkan migrasi database, dan data tetap ada karena volume tidak ikut terhapus.

```bash
cd /var/www/<APP_NAME>/releases/<timestamp>
docker compose -p <APP_NAME> --env-file /var/www/<APP_NAME>/.env up --build -d
ln -sfn "$PWD" /var/www/<APP_NAME>/current
```
