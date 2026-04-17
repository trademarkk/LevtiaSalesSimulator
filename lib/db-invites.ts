import { randomBytes } from "node:crypto";

import { getPool } from "@/lib/db-core";

export async function createManagerInvite(input: { city: string; email?: string }) {
  const city = input.city.trim();
  if (!city) throw new Error("Укажите город для инвайта.");
  const code = randomBytes(6).toString("hex").toUpperCase();
  await getPool().query("INSERT INTO manager_invites (code, city, email) VALUES ($1, $2, $3)", [code, city, input.email?.trim().toLowerCase() || null]);
  return { code, city, email: input.email?.trim().toLowerCase() || null };
}

export async function listManagerInvites() {
  const result = await getPool().query(`SELECT id, code, city, email, is_used, created_at, used_at FROM manager_invites ORDER BY created_at DESC, id DESC`);
  return result.rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code),
    city: String(row.city),
    email: row.email ? String(row.email) : null,
    isUsed: Boolean(row.is_used),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    usedAt: row.used_at ? (row.used_at instanceof Date ? row.used_at.toISOString() : String(row.used_at)) : null,
  }));
}
