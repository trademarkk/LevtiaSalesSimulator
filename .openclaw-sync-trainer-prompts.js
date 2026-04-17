require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'lib', 'db.ts');
const src = fs.readFileSync(dbPath, 'utf8');
const match = src.match(/function buildDefaultTrainerPrompt\(city: string\) \{[\s\S]*?\n\}/);

if (!match) {
  throw new Error('buildDefaultTrainerPrompt not found in lib/db.ts');
}

const fnCode = match[0].replace('function buildDefaultTrainerPrompt(city: string)', 'function buildDefaultTrainerPrompt(city)');
eval(fnCode);

if (typeof buildDefaultTrainerPrompt !== 'function') {
  throw new Error('Failed to load buildDefaultTrainerPrompt');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not found in .env/.env.local');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const result = await pool.query("SELECT DISTINCT email, city FROM users WHERE role = 'manager' AND email IS NOT NULL AND city IS NOT NULL AND TRIM(city) <> '' ORDER BY email ASC");
  const summary = [];

  for (const row of result.rows) {
    const ownerEmail = String(row.email ?? '').trim().toLowerCase();
    const city = String(row.city ?? '').trim();
    if (!city || !ownerEmail) continue;

    await pool.query(
      `INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key, owner_email) DO UPDATE SET value = EXCLUDED.value, city = EXCLUDED.city, updated_at = NOW()`,
      ['trainer_prompt', buildDefaultTrainerPrompt(city), city, ownerEmail],
    );

    summary.push({ ownerEmail, city });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
