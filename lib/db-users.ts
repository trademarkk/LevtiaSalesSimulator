import type { UserRecord } from "@/lib/types";
import { getPool, hashPassword, type DbRow } from "@/lib/db-core";

function normalizeUser(row: DbRow): UserRecord {
  return {
    id: Number(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role as UserRecord["role"],
    name: String(row.name),
    city: String(row.city ?? row.name ?? ""),
    managerEmail: row.manager_email ? String(row.manager_email) : null,
    status: String(row.status ?? "active") as UserRecord["status"],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function getOne<T>(query: string, values: unknown[] = [], normalizer?: (row: DbRow) => T): Promise<T | null> {
  const result = await getPool().query(query, values);
  if (result.rowCount === 0) return null;
  return normalizer ? normalizer(result.rows[0] as DbRow) : (result.rows[0] as T);
}

export async function getUserByEmail(email: string) {
  return getOne("SELECT * FROM users WHERE email = $1 LIMIT 1", [email], normalizeUser);
}

export async function getUserById(id: number) {
  return getOne("SELECT * FROM users WHERE id = $1 LIMIT 1", [id], normalizeUser);
}

export async function listAdminAccounts(ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query(
    `SELECT u.id, u.name, u.email, u.city, u.status, u.created_at, COUNT(ts.id) AS training_count, MAX(ts.completed_at) AS last_training_at
     FROM users u
     LEFT JOIN training_sessions ts ON ts.admin_user_id = u.id AND ts.owner_email = $1
     WHERE u.role = 'admin' AND u.manager_email = $1
     GROUP BY u.id, u.name, u.email, u.city, u.status, u.created_at
     ORDER BY u.created_at DESC`,
    [normalizedOwnerEmail],
  );
  return result.rows as Array<Record<string, unknown>>;
}

export async function setAdminStatus(id: number, ownerEmail: string, status: "active" | "disabled") {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query("UPDATE users SET status = $1 WHERE id = $2 AND manager_email = $3 AND role = 'admin'", [status, id, normalizedOwnerEmail]);
  return listAdminAccounts(normalizedOwnerEmail);
}

export async function resetAdminPassword(id: number, ownerEmail: string, password: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query("UPDATE users SET password_hash = $1 WHERE id = $2 AND manager_email = $3 AND role = 'admin'", [hashPassword(password), id, normalizedOwnerEmail]);
  return true;
}

export async function deleteAdminAccount(id: number, ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query("DELETE FROM users WHERE id = $1 AND manager_email = $2 AND role = 'admin'", [id, normalizedOwnerEmail]);
  return listAdminAccounts(normalizedOwnerEmail);
}

export async function listManagerAccounts() {
  const result = await getPool().query(`SELECT id, name, email, city, status, created_at FROM users WHERE role = 'manager' ORDER BY created_at DESC, id DESC`);
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    city: String(row.city ?? row.name ?? ''),
    status: String(row.status ?? 'active') as 'active' | 'disabled',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function setManagerStatus(id: number, status: 'active' | 'disabled') {
  await getPool().query("UPDATE users SET status = $1 WHERE id = $2 AND role = 'manager'", [status, id]);
  return listManagerAccounts();
}
