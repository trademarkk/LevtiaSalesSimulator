import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const city = process.argv[2] || 'Краснодар';
const email = process.argv[3] || null;
const dbPath = path.join(process.cwd(), 'data', 'levita.sqlite');
const db = new DatabaseSync(dbPath);
const code = randomBytes(6).toString('hex').toUpperCase();

db.exec(`
  CREATE TABLE IF NOT EXISTS manager_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    email TEXT,
    is_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TEXT
  );
`);

db.prepare('INSERT INTO manager_invites (code, city, email) VALUES (?, ?, ?)').run(code, city, email);
console.log(code);
