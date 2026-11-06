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
2. Mem-build backend dan frontend di runner GitHub.
3. Mengirim hasilnya ke VPS lewat SSH ke `/var/www/<APP_NAME>/releases/<timestamp>`.
4. Di server: `npm ci --omit=dev`, `prisma migrate deploy`, mengarahkan symlink `current`, dan me-restart proses PM2.
5. Mengecek `/health` dan menyimpan 5 release terakhir.

Migrasi berjalan sebelum proses baru dinyalakan dan tidak ikut dibatalkan jika deploy gagal setelahnya. Pastikan migrasi kompatibel dengan versi sebelumnya.

### Menjalankan deploy

Buka tab **Actions**, pilih **Deploy to VPS**, klik **Run workflow**, lalu pilih branch dan environment. Sebaiknya aktifkan **Required reviewers** pada environment `production`.

### Konfigurasi GitHub

Buat environment `staging` dan `production` di **Settings > Environments**, lalu isi nilai berikut pada masing-masing environment.

| Jenis | Nama | Isi |
| --- | --- | --- |
| Secret | `SSH_PRIVATE_KEY` | Private key khusus deploy |
| Secret | `VPS_HOST` | Host atau IP server |
| Secret | `VPS_USER` | User SSH di server |
| Variable | `APP_NAME` | Nama aplikasi, misalnya `crm-staging`. Hanya huruf, angka, dan tanda hubung. |
| Variable | `APP_DOMAIN` | Domain frontend |
| Variable | `API_URL` | URL publik API yang diakses browser |
| Variable | `API_PORT` | Opsional. Default `3000`. |
| Variable | `WEB_PORT` | Opsional. Default `3001`. |

### Persiapan server (sekali saja)

Server membutuhkan Node.js 20, PM2, dan MySQL 8.0. Sediakan juga reverse proxy dengan HTTPS, yang tidak diatur oleh workflow ini. Arahkan `APP_DOMAIN` ke `WEB_PORT` dan host dari `API_URL` ke `API_PORT`.

HTTPS wajib karena cookie login memakai atribut `Secure` saat `NODE_ENV=production`.

```bash
sudo mkdir -p /var/www/<APP_NAME>/shared
sudo chown -R <VPS_USER> /var/www/<APP_NAME>
nano /var/www/<APP_NAME>/shared/backend.env
chmod 600 /var/www/<APP_NAME>/shared/backend.env
```

Isi `backend.env`:

```env
DATABASE_URL=mysql://<user>:<password>@127.0.0.1:3306/<database>
JWT_SECRET=<nilai acak yang panjang>
CORS_ORIGINS=https://<APP_DOMAIN>
DEV_BASE_URL=<API_URL>
ALLOW_PUBLIC_REGISTRATION=false
```

Pendaftaran tertutup selama `ALLOW_PUBLIC_REGISTRATION` bukan `true`. Untuk membuat akun pertama, set sementara ke `true`, jalankan `pm2 restart <APP_NAME>-api --update-env`, daftar di `/register`, lalu kembalikan ke `false` dan restart lagi.

File `backend.env` dan folder `uploads` berada di `shared`, sehingga tetap ada di setiap release.

### Rollback

Masuk ke server, arahkan `current` ke release sebelumnya, lalu jalankan ulang kedua proses dari folder release tersebut. Rollback ini tidak membatalkan migrasi database.

```bash
ln -sfn /var/www/<APP_NAME>/releases/<timestamp> /var/www/<APP_NAME>/current

cd /var/www/<APP_NAME>/current/backend
pm2 delete <APP_NAME>-api
NODE_ENV=production PORT=<API_PORT> pm2 start dist/index.js --name <APP_NAME>-api --update-env

cd /var/www/<APP_NAME>/current/frontend
pm2 delete <APP_NAME>-web
NODE_ENV=production PORT=<WEB_PORT> HOSTNAME=127.0.0.1 pm2 start server.js --name <APP_NAME>-web --update-env

pm2 save
```
