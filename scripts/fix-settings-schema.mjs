import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const db = new DatabaseSync(path.join(process.cwd(), 'data', 'levita.sqlite'));
const indexes = db.prepare('PRAGMA index_list(settings)').all();
const hasCompositePk = indexes.some((idx) => String(idx.name).includes('sqlite_autoindex_settings_1'));
const info = db.prepare('PRAGMA table_info(settings)').all();
const pkCols = info.filter((c) => Number(c.pk) > 0).map((c) => c.name);
if (pkCols.length === 2 && pkCols.includes('key') && pkCols.includes('city')) {
  console.log('settings schema already ok');
  process.exit(0);
}

const rows = db.prepare('SELECT key, value, updated_at, city FROM settings').all();
db.exec('ALTER TABLE settings RENAME TO settings_legacy;');
db.exec(`CREATE TABLE settings (key TEXT NOT NULL, value TEXT NOT NULL, city TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (key, city));`);
const insert = db.prepare('INSERT INTO settings (key, value, city, updated_at) VALUES (?, ?, ?, ?)');
for (const row of rows) {
  insert.run(row.key, row.value, row.city || 'Краснодар', row.updated_at || new Date().toISOString());
}
db.exec('DROP TABLE settings_legacy;');
console.log('settings schema fixed');
