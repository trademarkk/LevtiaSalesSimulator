import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query('BEGIN');

  await client.query("DELETE FROM training_sessions WHERE admin_user_id IN (SELECT id FROM users WHERE role <> 'master') OR city <> 'GLOBAL'");
  await client.query("DELETE FROM manager_invites WHERE city <> 'GLOBAL' OR city IS NOT NULL");
  await client.query("DELETE FROM objections WHERE city <> 'GLOBAL' OR city IS NOT NULL");
  await client.query("DELETE FROM settings WHERE city <> 'GLOBAL' OR city IS NOT NULL");
  await client.query("DELETE FROM users WHERE role <> 'master'");

  await client.query('COMMIT');
  console.log('Purge complete. Kept only master user.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
