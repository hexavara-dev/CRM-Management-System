import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
  override: false,
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'Missing database URL. Set DATABASE_URL in .env.'
  );
}

// Parse the connection string manually
const parsed = new URL(connectionString);
const dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
if (!dbName) {
  throw new Error('Database name is missing from DATABASE_URL.');
}

// Pass configuration options directly to PrismaMariaDb
const adapter = new PrismaMariaDb({
  host: parsed.hostname || 'localhost',
  port: parsed.port ? parseInt(parsed.port, 10) : 3306,
  user: parsed.username || 'root',
  password: parsed.password ? decodeURIComponent(parsed.password) : '',
  database: dbName,
  connectionLimit: 10,
  // MySQL 8 (caching_sha2_password) meminta kunci RSA setelah DB restart; tanpa ini semua koneksi gagal.
  // Aman untuk jaringan Docker internal / localhost; untuk DB lintas jaringan publik, pakai ssl.
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({ adapter });
