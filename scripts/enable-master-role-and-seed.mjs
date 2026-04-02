import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';

const { Client } = pg;
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const email = process.env.MASTER_EMAIL || 'master@levita.app';
const password = process.env.MASTER_PASSWORD || 'MasterLevita2026!';

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'master'))`);
  await client.query(`INSERT INTO users (email, password_hash, role, name, city, status)
    VALUES ($1, $2, 'master', 'Master', 'GLOBAL', 'active')
    ON CONFLICT (email) DO UPDATE SET role = 'master', status = 'active'`, [email, hashPassword(password)]);
  console.log(`master ready: ${email}`);
  await client.end();
}

main().catch(async (error) => { console.error(error); try { await client.end(); } catch {} process.exit(1); });
