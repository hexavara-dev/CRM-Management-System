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

Server membutuhkan Docker dengan Compose, dan `VPS_USER` harus bisa menjalankan `docker` tanpa `sudo`. Sediakan juga reverse proxy dengan HTTPS, yang tidak diatur oleh workflow ini. Arahkan domain frontend ke `127.0.0.1:3001` dan domain API ke `127.0.0.1:3000`.

HTTPS wajib karena cookie login memakai atribut `Secure`.

```bash
sudo mkdir -p /var/www/<APP_NAME>
sudo chown -R <VPS_USER> /var/www/<APP_NAME>
nano /var/www/<APP_NAME>/.env
chmod 600 /var/www/<APP_NAME>/.env
```

Isi `.env` mengikuti [`.env.example`](../.env.example). Penjelasan tiap variabelnya ada di [panduan instalasi](INSTALLATION.md#deploy-ke-server-dengan-docker).

Satu server hanya bisa menjalankan satu environment, karena nama container dan port di `docker-compose.yml` bernilai tetap.

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
