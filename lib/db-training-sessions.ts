import type { ChatMessage, TrainingAdministratorSummary, TrainingSessionRecord, TrainerMode, ScenarioContext } from "@/lib/types";
import { getPool, type DbRow } from "@/lib/db-core";

function normalizeTrainingSession(row: DbRow): TrainingSessionRecord {
  return {
    id: Number(row.id),
    adminDisplayName: String(row.admin_display_name),
    adminUserId: row.admin_user_id == null ? null : Number(row.admin_user_id),
    scenarioDifficulty: row.scenario_difficulty as TrainingSessionRecord["scenarioDifficulty"],
    stepCount: Number(row.step_count),
    trainerMode: row.trainer_mode as TrainerMode,
    evaluationText: String(row.evaluation_text),
    score: row.score == null ? null : Number(row.score),
    transcript: JSON.parse(String(row.transcript_json)) as ChatMessage[],
    startedAt: String(row.started_at),
    completedAt: String(row.completed_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function extractTrainingScore(evaluationText: string) {
  const match = evaluationText.match(/Общая оценка:\s*(\d{1,2})/i) || evaluationText.match(/Оценка:\s*(\d{1,2})/i);
  if (!match) return null;
  const score = Number(match[1]);
  return Number.isFinite(score) ? score : null;
}

export async function createTrainingSession(input: { adminDisplayName: string; adminUserId?: number | null; city: string; ownerEmail: string; scenario: ScenarioContext; trainerMode: TrainerMode; evaluationText: string; transcript: ChatMessage[]; startedAt: string; completedAt?: string; }) {
  const completedAt = input.completedAt || new Date().toISOString();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  await getPool().query(
    `INSERT INTO training_sessions (admin_display_name, admin_user_id, city, owner_email, scenario_difficulty, step_count, trainer_mode, evaluation_text, score, transcript_json, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [input.adminDisplayName.trim(), input.adminUserId ?? null, input.city.trim(), ownerEmail, input.scenario.difficulty, input.scenario.stepCount, input.trainerMode, input.evaluationText.trim(), extractTrainingScore(input.evaluationText), JSON.stringify(input.transcript), input.startedAt, completedAt],
  );
}

export async function listTrainingAdministrators(ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query(
    `SELECT admin_display_name, COUNT(*) AS session_count, AVG(score) AS average_score, MAX(completed_at) AS last_completed_at
     FROM training_sessions
     WHERE owner_email = $1
     GROUP BY admin_display_name
     ORDER BY last_completed_at DESC, admin_display_name ASC`,
    [normalizedOwnerEmail],
  );

  return result.rows.map((row) => ({
    adminDisplayName: String(row.admin_display_name),
    sessionCount: Number(row.session_count),
    averageScore: row.average_score == null ? null : Math.round(Number(row.average_score) * 10) / 10,
    lastCompletedAt: String(row.last_completed_at),
  })) satisfies TrainingAdministratorSummary[];
}

export async function listTrainingSessionsByAdministrator(adminDisplayName: string, ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query(
    `SELECT * FROM training_sessions WHERE admin_display_name = $1 AND owner_email = $2 ORDER BY completed_at DESC, id DESC`,
    [adminDisplayName, normalizedOwnerEmail],
  );
  return result.rows.map((row) => normalizeTrainingSession(row as DbRow));
}

export async function getTrainingSessionById(id: number, ownerEmail?: string) {
  const result = ownerEmail
    ? await getPool().query("SELECT * FROM training_sessions WHERE id = $1 AND owner_email = $2 LIMIT 1", [id, ownerEmail.trim().toLowerCase()])
    : await getPool().query("SELECT * FROM training_sessions WHERE id = $1 LIMIT 1", [id]);

  return (result.rowCount ?? 0) > 0 ? normalizeTrainingSession(result.rows[0] as DbRow) : null;
}

export async function deleteTrainingSessionsById(ids: number[], ownerEmail: string) {
  if (!ids.length) return 0;
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
  const result = await getPool().query("DELETE FROM training_sessions WHERE id = ANY($1::int[]) AND owner_email = $2", [ids, normalizedOwnerEmail]);
  return Number(result.rowCount || 0);
}
