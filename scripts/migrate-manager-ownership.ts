import "dotenv/config";

import { Pool } from "pg";

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL не задан.");
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
}

async function main() {
  const pool = getPool();

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_email TEXT`);
  await pool.query(`ALTER TABLE objections ADD COLUMN IF NOT EXISTS owner_email TEXT`);
  await pool.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS owner_email TEXT`);
  await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_email TEXT`);

  await pool.query(`UPDATE users SET manager_email = LOWER(email) WHERE role = 'manager' AND (manager_email IS NULL OR TRIM(manager_email) = '')`);
  await pool.query(`
    UPDATE users admin
    SET manager_email = LOWER(manager.email)
    FROM users manager
    WHERE admin.role = 'admin'
      AND manager.role = 'manager'
      AND admin.city IS NOT NULL
      AND manager.city IS NOT NULL
      AND admin.city = manager.city
      AND (admin.manager_email IS NULL OR TRIM(admin.manager_email) = '')
  `);

  await pool.query(`
    UPDATE objections o
    SET owner_email = LOWER(manager.email)
    FROM users manager
    WHERE manager.role = 'manager'
      AND o.city IS NOT NULL
      AND manager.city IS NOT NULL
      AND o.city = manager.city
      AND (o.owner_email IS NULL OR TRIM(o.owner_email) = '')
  `);

  await pool.query(`
    UPDATE settings s
    SET owner_email = LOWER(manager.email)
    FROM users manager
    WHERE manager.role = 'manager'
      AND s.city IS NOT NULL
      AND manager.city IS NOT NULL
      AND s.city = manager.city
      AND s.key = 'trainer_prompt'
      AND (s.owner_email IS NULL OR TRIM(s.owner_email) = '')
  `);

  await pool.query(`
    UPDATE training_sessions ts
    SET owner_email = LOWER(admin.manager_email)
    FROM users admin
    WHERE ts.admin_user_id = admin.id
      AND admin.manager_email IS NOT NULL
      AND TRIM(admin.manager_email) <> ''
      AND (ts.owner_email IS NULL OR TRIM(ts.owner_email) = '')
  `);

  await pool.query(`
    UPDATE training_sessions ts
    SET owner_email = LOWER(manager.email)
    FROM users manager
    WHERE manager.role = 'manager'
      AND ts.city = manager.city
      AND (ts.owner_email IS NULL OR TRIM(ts.owner_email) = '')
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_manager_email ON users(manager_email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_objections_owner_email ON objections(owner_email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_sessions_owner_email ON training_sessions(owner_email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_settings_owner_email ON settings(owner_email)`);

  await pool.query(`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`);
  await pool.query(`ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key, owner_email)`);

  const summary = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND (manager_email IS NULL OR TRIM(manager_email) = '')`),
    pool.query(`SELECT COUNT(*)::int AS count FROM objections WHERE owner_email IS NULL OR TRIM(owner_email) = ''`),
    pool.query(`SELECT COUNT(*)::int AS count FROM training_sessions WHERE owner_email IS NULL OR TRIM(owner_email) = ''`),
    pool.query(`SELECT COUNT(*)::int AS count FROM settings WHERE owner_email IS NULL OR TRIM(owner_email) = ''`),
  ]);

  console.log(JSON.stringify({
    adminsWithoutManagerEmail: summary[0].rows[0]?.count ?? 0,
    objectionsWithoutOwnerEmail: summary[1].rows[0]?.count ?? 0,
    trainingSessionsWithoutOwnerEmail: summary[2].rows[0]?.count ?? 0,
    settingsWithoutOwnerEmail: summary[3].rows[0]?.count ?? 0,
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
