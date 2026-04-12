import "dotenv/config";

import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL не задан.");
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  const users = await pool.query(`
    SELECT id, email, role, city, manager_email
    FROM users
    WHERE email IN ('ruko@ruko.ru', 'adm@adm.ru')
    ORDER BY role DESC, id ASC
  `);

  const objections = await pool.query(`
    SELECT owner_email, city, COUNT(*)::int AS count
    FROM objections
    WHERE owner_email IN ('ruko@ruko.ru')
    GROUP BY owner_email, city
  `);

  console.log(JSON.stringify({ users: users.rows, objections: objections.rows }, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
