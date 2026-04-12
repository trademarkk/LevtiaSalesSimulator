import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = ['users', 'manager_invites', 'training_sessions', 'objections', 'settings'];

try {
  await client.connect();
  const users = await client.query('SELECT id, email, role, name, city FROM users ORDER BY id');

  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    console.log(`${table}: ${result.rows[0].count}`);
  }

  console.log('USERS:');
  console.log(JSON.stringify(users.rows, null, 2));
} finally {
  await client.end();
}
