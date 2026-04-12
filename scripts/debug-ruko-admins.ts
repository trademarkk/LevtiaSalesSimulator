import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL не задан.");
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  const users = await pool.query(`
    SELECT id, email, role, city, manager_email, status, created_at
    FROM users
    WHERE email IN ('ruko@ruko.ru', 'adm@adm.ru') OR manager_email = 'ruko@ruko.ru'
    ORDER BY role DESC, id ASC
  `);

  const adminsSummary = await pool.query(`
    SELECT u.id, u.email, u.name, u.city, u.manager_email, COUNT(ts.id) AS training_count
    FROM users u
    LEFT JOIN training_sessions ts ON ts.admin_user_id = u.id AND ts.owner_email = 'ruko@ruko.ru'
    WHERE u.role = 'admin' AND u.manager_email = 'ruko@ruko.ru'
    GROUP BY u.id, u.email, u.name, u.city, u.manager_email
    ORDER BY u.id ASC
  `);

  console.log(JSON.stringify({ users: users.rows, adminsSummary: adminsSummary.rows }, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
