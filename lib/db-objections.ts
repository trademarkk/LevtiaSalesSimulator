import type { ObjectionRecord } from "@/lib/types";
import { getPool, type DbRow } from "@/lib/db-core";

function normalizeObjection(row: DbRow): ObjectionRecord {
  return {
    id: Number(row.id),
    title: String(row.title),
    objectionText: String(row.objection_text),
    coachHint: String(row.coach_hint ?? ""),
    stage: String(row.stage),
    difficulty: row.difficulty as ObjectionRecord["difficulty"],
    isActive: row.is_active ? 1 : 0,
    isRequired: row.is_required ? 1 : 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function listObjections(ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query("SELECT * FROM objections WHERE owner_email = $1 ORDER BY is_required DESC, is_active DESC, updated_at DESC, id DESC", [normalizedOwnerEmail]);
  return result.rows.map((row) => normalizeObjection(row as DbRow));
}

export async function listActiveObjections(ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query("SELECT * FROM objections WHERE is_active = TRUE AND owner_email = $1 ORDER BY is_required DESC, id DESC", [normalizedOwnerEmail]);
  return result.rows.map((row) => normalizeObjection(row as DbRow));
}

export async function getObjectionsByIds(ids: number[], ownerEmail?: string) {
  if (!ids.length) return [];
  const values: unknown[] = [ids];
  let query = "SELECT * FROM objections WHERE id = ANY($1::int[])";
  if (ownerEmail) {
    values.push(ownerEmail.trim().toLowerCase());
    query += " AND owner_email = $2";
  }
  query += " ORDER BY id ASC";
  const result = await getPool().query(query, values);
  const normalizedRows = result.rows.map((row) => normalizeObjection(row as DbRow));
  const rowsById = new Map(normalizedRows.map((row) => [row.id, row]));
  return ids.map((id) => rowsById.get(id)).filter((row): row is ObjectionRecord => Boolean(row));
}

export async function createObjection(input: { title: string; objectionText: string; coachHint: string; stage: string; difficulty: "easy" | "medium" | "hard"; isActive: boolean; isRequired: boolean; city: string; ownerEmail: string; }) {
  const city = input.city.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  await getPool().query(
    `INSERT INTO objections (title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, owner_email, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [input.title.trim(), input.objectionText.trim(), input.coachHint.trim(), input.stage.trim(), input.difficulty, input.isActive, input.isRequired, city, ownerEmail],
  );
  return listObjections(ownerEmail);
}

export async function updateObjection(id: number, input: { title: string; objectionText: string; coachHint: string; stage: string; difficulty: "easy" | "medium" | "hard"; isActive: boolean; isRequired: boolean; city: string; ownerEmail: string; }) {
  const city = input.city.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  await getPool().query(
    `UPDATE objections SET title = $1, objection_text = $2, coach_hint = $3, stage = $4, difficulty = $5, is_active = $6, is_required = $7, city = $8, updated_at = NOW()
     WHERE id = $9 AND owner_email = $10`,
    [input.title.trim(), input.objectionText.trim(), input.coachHint.trim(), input.stage.trim(), input.difficulty, input.isActive, input.isRequired, city, id, ownerEmail],
  );
  return listObjections(ownerEmail);
}

export async function setObjectionActive(id: number, isActive: boolean, ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query("UPDATE objections SET is_active = $1, updated_at = NOW() WHERE id = $2 AND owner_email = $3", [isActive, id, normalizedOwnerEmail]);
  return listObjections(normalizedOwnerEmail);
}

export async function setObjectionRequired(id: number, isRequired: boolean, ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query("UPDATE objections SET is_required = $1, updated_at = NOW() WHERE id = $2 AND owner_email = $3", [isRequired, id, normalizedOwnerEmail]);
  return listObjections(normalizedOwnerEmail);
}

export async function deleteObjection(id: number, ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  await getPool().query("DELETE FROM objections WHERE id = $1 AND owner_email = $2", [id, normalizedOwnerEmail]);
  return listObjections(normalizedOwnerEmail);
}
