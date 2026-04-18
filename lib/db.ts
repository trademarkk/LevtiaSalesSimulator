import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export {
  createManagerInvite,
  listManagerInvites,
} from "@/lib/db-invites";
export {
  buildDefaultTrainerPrompt,
  ensureAllManagersHaveDefaultObjections,
  ensureManagerData,
  insertMissingObjectionsForOwner,
  overwriteAllManagersWithDefaultTrainerPrompt,
} from "@/lib/db-manager-defaults";
export {
  createObjection,
  deleteObjection,
  getObjectionsByIds,
  listActiveObjections,
  listObjections,
  setObjectionActive,
  setObjectionRequired,
  updateObjection,
} from "@/lib/db-objections";
export {
  getSetting,
  setSetting,
} from "@/lib/db-settings";
export {
  deleteAdminAccount,
  getUserByEmail,
  getUserById,
  listAdminAccounts,
  listManagerAccounts,
  resetAdminPassword,
  setAdminStatus,
  setManagerStatus,
} from "@/lib/db-users";
export {
  createTrainingSession,
  deleteTrainingSessionsById,
  getTrainingSessionById,
  listTrainingAdministrators,
  listTrainingSessionsByAdministrator,
} from "@/lib/db-training-sessions";

import { getPool } from "@/lib/db-core";
import { ensureManagerData } from "@/lib/db-manager-defaults";
import { getUserByEmail } from "@/lib/db-users";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;
  const derivedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (storedBuffer.length !== derivedHash.length) return false;
  return timingSafeEqual(storedBuffer, derivedHash);
}

async function getOne<T>(query: string, values: unknown[] = []): Promise<T | null> {
  const result = await getPool().query(query, values);
  if (result.rowCount === 0) return null;
  return result.rows[0] as T;
}

export async function createAdminUser(input: { city: string; email: string; password: string; name?: string; managerEmail?: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedCity = input.city.trim();
  const normalizedName = input.name?.trim() || normalizedCity;
  const normalizedManagerEmail = input.managerEmail?.trim().toLowerCase() || null;
  if (!normalizedCity) throw new Error("Укажите город.");
  if (!normalizedManagerEmail) throw new Error("Не найден email руководителя для привязки администратора.");
  if (await getUserByEmail(normalizedEmail)) throw new Error("Пользователь с таким email уже существует.");

  await getPool().query(
    "INSERT INTO users (email, password_hash, role, name, city, manager_email, status) VALUES ($1, $2, 'admin', $3, $4, $5, 'active')",
    [normalizedEmail, hashPassword(input.password), normalizedName, normalizedCity, normalizedManagerEmail],
  );

  await ensureManagerData({ city: normalizedCity, ownerEmail: normalizedManagerEmail });
  return getUserByEmail(normalizedEmail);
}

export async function createManagerUserFromInvite(input: { code: string; city: string; email: string; password: string }) {
  const normalizedCode = input.code.trim().toUpperCase();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedCity = input.city.trim();
  const invite = await getOne<Record<string, unknown>>("SELECT * FROM manager_invites WHERE code = $1 LIMIT 1", [normalizedCode]);
  if (!invite) throw new Error("Инвайт-код не найден.");
  if (Boolean(invite.is_used)) throw new Error("Этот инвайт-код уже использован.");
  if (invite.email && String(invite.email).toLowerCase() !== normalizedEmail) throw new Error("Этот инвайт-код привязан к другому email.");
  if (!normalizedCity) throw new Error("Укажите город.");
  if (await getUserByEmail(normalizedEmail)) throw new Error("Пользователь с таким email уже существует.");

  await getPool().query(
    "INSERT INTO users (email, password_hash, role, name, city, manager_email, status) VALUES ($1, $2, 'manager', $3, $4, $5, 'active')",
    [normalizedEmail, hashPassword(input.password), normalizedCity, normalizedCity, normalizedEmail],
  );
  await getPool().query("UPDATE manager_invites SET is_used = TRUE, used_at = NOW() WHERE code = $1", [normalizedCode]);
  await ensureManagerData({ city: normalizedCity, ownerEmail: normalizedEmail });
  return getUserByEmail(normalizedEmail);
}
