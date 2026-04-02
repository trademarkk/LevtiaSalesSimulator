import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL не найден в .env.local');
}

const sqlite = new DatabaseSync(path.join(process.cwd(), 'data', 'levita.sqlite'));
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
    name TEXT NOT NULL,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS manager_invites (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    email TEXT,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
  );`,
  `CREATE TABLE IF NOT EXISTS objections (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    objection_text TEXT NOT NULL,
    coach_hint TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'general',
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT NOT NULL,
    city TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, city)
  );`,
  `CREATE TABLE IF NOT EXISTS training_sessions (
    id SERIAL PRIMARY KEY,
    admin_display_name TEXT NOT NULL,
    admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    city TEXT,
    scenario_difficulty TEXT NOT NULL CHECK (scenario_difficulty IN ('easy', 'medium', 'hard')),
    step_count INTEGER NOT NULL,
    trainer_mode TEXT NOT NULL CHECK (trainer_mode IN ('openai', 'deepseek', 'openrouter', 'demo')),
    evaluation_text TEXT NOT NULL,
    score INTEGER,
    transcript_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_users_city_role ON users(city, role);`,
  `CREATE INDEX IF NOT EXISTS idx_objections_city_active ON objections(city, is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_training_sessions_city_admin ON training_sessions(city, admin_display_name);`
];

async function main() {
  await client.connect();
  for (const statement of statements) {
    await client.query(statement);
  }

  const users = sqlite.prepare('SELECT * FROM users ORDER BY id').all();
  for (const row of users) {
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, name, city, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         name = EXCLUDED.name,
         city = EXCLUDED.city,
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at`,
      [Number(row.id), String(row.email), String(row.password_hash), String(row.role), String(row.name), row.city == null ? null : String(row.city), String(row.status ?? 'active'), String(row.created_at)]
    );
  }

  const invites = sqlite.prepare('SELECT * FROM manager_invites ORDER BY id').all();
  for (const row of invites) {
    await client.query(
      `INSERT INTO manager_invites (id, code, city, email, is_used, created_at, used_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code,
         city = EXCLUDED.city,
         email = EXCLUDED.email,
         is_used = EXCLUDED.is_used,
         created_at = EXCLUDED.created_at,
         used_at = EXCLUDED.used_at`,
      [Number(row.id), String(row.code), String(row.city), row.email == null ? null : String(row.email), Boolean(row.is_used), String(row.created_at), row.used_at == null ? null : String(row.used_at)]
    );
  }

  const objections = sqlite.prepare('SELECT * FROM objections ORDER BY id').all();
  for (const row of objections) {
    await client.query(
      `INSERT INTO objections (id, title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         objection_text = EXCLUDED.objection_text,
         coach_hint = EXCLUDED.coach_hint,
         stage = EXCLUDED.stage,
         difficulty = EXCLUDED.difficulty,
         is_active = EXCLUDED.is_active,
         is_required = EXCLUDED.is_required,
         city = EXCLUDED.city,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [Number(row.id), String(row.title), String(row.objection_text), String(row.coach_hint ?? ''), String(row.stage), String(row.difficulty), Boolean(row.is_active), Boolean(row.is_required ?? 0), row.city == null ? null : String(row.city), String(row.created_at), String(row.updated_at)]
    );
  }

  const settings = sqlite.prepare('SELECT * FROM settings ORDER BY city, key').all();
  for (const row of settings) {
    await client.query(
      `INSERT INTO settings (key, city, value, updated_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (key, city) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at`,
      [String(row.key), String(row.city), String(row.value), String(row.updated_at)]
    );
  }

  const sessions = sqlite.prepare('SELECT * FROM training_sessions ORDER BY id').all();
  for (const row of sessions) {
    await client.query(
      `INSERT INTO training_sessions (id, admin_display_name, admin_user_id, city, scenario_difficulty, step_count, trainer_mode, evaluation_text, score, transcript_json, started_at, completed_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         admin_display_name = EXCLUDED.admin_display_name,
         admin_user_id = EXCLUDED.admin_user_id,
         city = EXCLUDED.city,
         scenario_difficulty = EXCLUDED.scenario_difficulty,
         step_count = EXCLUDED.step_count,
         trainer_mode = EXCLUDED.trainer_mode,
         evaluation_text = EXCLUDED.evaluation_text,
         score = EXCLUDED.score,
         transcript_json = EXCLUDED.transcript_json,
         started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at,
         created_at = EXCLUDED.created_at`,
      [Number(row.id), String(row.admin_display_name), row.admin_user_id == null ? null : Number(row.admin_user_id), row.city == null ? null : String(row.city), String(row.scenario_difficulty), Number(row.step_count), String(row.trainer_mode), String(row.evaluation_text), row.score == null ? null : Number(row.score), String(row.transcript_json), String(row.started_at), String(row.completed_at), String(row.created_at)]
    );
  }

  await client.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true)`);
  await client.query(`SELECT setval(pg_get_serial_sequence('manager_invites', 'id'), COALESCE((SELECT MAX(id) FROM manager_invites), 1), true)`);
  await client.query(`SELECT setval(pg_get_serial_sequence('objections', 'id'), COALESCE((SELECT MAX(id) FROM objections), 1), true)`);
  await client.query(`SELECT setval(pg_get_serial_sequence('training_sessions', 'id'), COALESCE((SELECT MAX(id) FROM training_sessions), 1), true)`);

  const counts = {
    users: (await client.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count,
    manager_invites: (await client.query('SELECT COUNT(*)::int AS count FROM manager_invites')).rows[0].count,
    objections: (await client.query('SELECT COUNT(*)::int AS count FROM objections')).rows[0].count,
    settings: (await client.query('SELECT COUNT(*)::int AS count FROM settings')).rows[0].count,
    training_sessions: (await client.query('SELECT COUNT(*)::int AS count FROM training_sessions')).rows[0].count,
  };

  console.log('migration complete', counts);
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  try { await client.end(); } catch {}
  process.exit(1);
});
