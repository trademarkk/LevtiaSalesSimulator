import { getPool } from "@/lib/db-core";

export async function getSetting(key: string, ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query("SELECT value FROM settings WHERE key = $1 AND owner_email = $2 LIMIT 1", [key, normalizedOwnerEmail]);
  return result.rows[0]?.value ? String(result.rows[0].value) : "";
}

export async function setSetting(key: string, value: string, ownerEmail: string, city: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query(
    `INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key, owner_email) DO UPDATE SET value = EXCLUDED.value, city = EXCLUDED.city, updated_at = NOW()`,
    [key, value.trim(), city.trim(), normalizedOwnerEmail],
  );
  return getSetting(key, normalizedOwnerEmail);
}
