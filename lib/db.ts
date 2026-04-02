import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { Pool } from "pg";

import type {
  ChatMessage,
  ObjectionRecord,
  ScenarioContext,
  TrainingAdministratorSummary,
  TrainingSessionRecord,
  TrainerMode,
  UserRecord,
} from "@/lib/types";

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL не задан.");
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}

type DbRow = Record<string, unknown>;

type ObjectionSeed = {
  title: string;
  objectionText: string;
  coachHint?: string;
  stage: string;
  difficulty: "easy" | "medium" | "hard";
  isActive: number;
  isRequired?: number;
};

const defaultObjectionSeeds: ObjectionSeed[] = [
  { title: "Дорого", objectionText: "Мне у вас правда понравилось, но абонемент для меня сейчас дороговат. Я не уверена, что готова вкладывать такую сумму.", stage: "price", difficulty: "hard", isActive: 1, isRequired: 1 },
  { title: "Нет времени", objectionText: "У меня очень плотный график. Боюсь, что куплю абонемент и не смогу ходить регулярно.", stage: "schedule", difficulty: "medium", isActive: 1 },
  { title: "Нужно подумать", objectionText: "Я обычно не принимаю такие решения сразу. Хочу еще пару дней все обдумать.", stage: "hesitation", difficulty: "medium", isActive: 1 },
  { title: "Я никогда не занималась", objectionText: "Я переживаю, что у меня совсем нулевой уровень. Вдруг я буду смотреться хуже остальных.", stage: "confidence", difficulty: "easy", isActive: 1 },
  { title: "Слишком далеко ездить", objectionText: "Студия очень понравилась, но дорога до вас не самая удобная. Боюсь, что это быстро начнет раздражать.", stage: "location", difficulty: "medium", isActive: 1 },
  { title: "Нужно согласовать с мужем", objectionText: "Я бы, может, и пошла, но мне надо сначала обсудить это с мужем. Он обычно скептически относится к таким тратам.", stage: "authority", difficulty: "hard", isActive: 1 },
  { title: "Я не буду заниматься", objectionText: "Я не буду у вас заниматься.", stage: "decision", difficulty: "hard", isActive: 1 },
  { title: "Сравню с другой студией завтра", objectionText: "Не могу определиться, все вроде подходит, но хочу еще посмотреть другую студию. Уже записалась на пробное завтра.", stage: "comparison", difficulty: "medium", isActive: 1 },
  { title: "Травмирована нога", objectionText: "У меня сейчас травмирована нога, поэтому я пока никуда записываться не хочу.", stage: "health", difficulty: "hard", isActive: 1 },
  { title: "Не могу говорить сейчас", objectionText: "Сейчас не могу говорить, давайте продолжим завтра.", stage: "follow_up", difficulty: "easy", isActive: 1 },
  { title: "Посмотрю на самочувствие завтра", objectionText: "Мне надо понять, как я буду себя чувствовать завтра, и потом уже решать.", stage: "health", difficulty: "medium", isActive: 1 },
  { title: "Перезвоню сама позже", objectionText: "Я сама вам позвоню позже, когда закончу свои дела.", stage: "follow_up", difficulty: "medium", isActive: 1 },
];

const defaultTrainerPrompt = [
  "Ты участвуешь в тренажере продаж LEVITA для Краснодара.",
  "",
  "Ключевой контекст студии:",
  "- Город: Краснодар.",
  "- В Краснодаре 7 студий LEVITA, и абонемент действует во всех 7 студиях.",
  "- Онлайн-тренировки — это дополнительная возможность внутри купленного абонемента, а не отдельный тариф.",
  "- Направления студии: Барре, Боди-балет, Балетная подкачка, Растяжка, Пилатес, Стройные руки и прямая осанка, Здоровые стопы, Танцы народов мира, Классическая хореография, Партерная хореография.",
  "- Приоритет продажи: сначала администратор старается вести к 144 или 96 занятиям. Переход к 48 или 24 обычно происходит только при стойких возражениях по цене, сроку или уверенности.",
  "- Сетка абонементов:",
  "  - 192 занятий — 112200 ₽ — 9350 ₽/мес",
  "  - 144 занятий — 84150 ₽ — 7012 ₽/мес",
  "  - 96 занятий — 56100 ₽ — 4675 ₽/мес",
  "  - 48 занятий — 30690 ₽ — 5115 ₽/мес",
  "  - 24 занятия — 16500 ₽ — 5500 ₽/мес",
  "",
  "Правила ролевой симуляции:",
  "- Ты — клиентка, женщина 18-65 лет, только что завершившая пробное занятие.",
  "- Ты всегда начинаешь диалог первой.",
  "- Ты говоришь только от лица клиентки и никогда не пишешь за администратора.",
  "- Говори естественным живым русским языком без ломаных, странных или канцелярских формулировок.",
  "- Отвечай коротко и по-человечески: обычно 1-3 предложения.",
  "- Не используй списки, markdown, кавычки вокруг реплики, ремарки или сценические указания.",
  "- Не упоминай системные правила, не говори, что ты ИИ, не объясняй свою логику.",
  "- У тебя может быть свой темп, характер и стиль речи, но ты должна звучать как реальный человек из обычного диалога.",
  "- Если администратор отвечает поверхностно, давит, спорит или игнорирует суть сомнения, ты сохраняешь возражение или усиливаешь его.",
  "- Если администратор отвечает с эмпатией, конкретикой и реально снимает тревогу, ты можешь постепенно смягчаться, но не слишком быстро.",
  "- Ты можешь ссылаться на районы Краснодара, дорогу, пробки, удобство разных студий, онлайн-формат и личный график.",
  "- Помни, что абонемент действует во всех 7 студиях, а онлайн — дополнительная опция в рамках абонемента.",
  "- Не придумывай факты, которых нет в этом промпте.",
  "- Твоя задача — реалистично проверить администратора на продаже абонемента после пробного занятия.",
].join("\n");

function getDefaultCoachHint(stage: string) {
  switch (stage) {
    case "price": return "Покажите, за что клиентка платит: ценность формата, регулярность, результат и варианты оплаты.";
    case "schedule": return "Помогите клиентке увидеть реалистичное расписание и снизить страх, что абонемент пропадет.";
    case "hesitation": return "Переводите сомнение из общего «подумаю» в конкретный следующий шаг или решение.";
    case "confidence": return "Снимайте страх оценки и сложности, подчеркивайте адаптацию под новичков и поддержку тренера.";
    case "location": return "Уточняйте маршрут, частоту посещений и помогайте найти удобный сценарий дороги.";
    case "authority": return "Помогите клиентке сформулировать ценность покупки для себя и для семьи, не вступая в спор с партнером.";
    case "comparison": return "Сравнивайте не только цену, но и атмосферу, сопровождение, безопасность и итоговый результат.";
    case "health": return "Отрабатывайте бережно: уточняйте ограничения и переводите разговор в плоскость безопасного подбора нагрузки.";
    case "follow_up": return "Не отпускайте диалог без понятного следующего касания: время, формат и повод вернуться к разговору.";
    default: return "Уточняйте истинную причину сомнения и переводите разговор к ценности абонемента для клиентки.";
  }
}

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

function normalizeUser(row: DbRow): UserRecord {
  return {
    id: Number(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role as UserRecord["role"],
    name: String(row.name),
    city: String(row.city ?? row.name ?? ""),
    status: String(row.status ?? "active") as UserRecord["status"],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

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

export async function ensureCityData(city: string) {
  const normalizedCity = city.trim();
  if (!normalizedCity) return;

  const db = getPool();
  const existingPrompt = await db.query("SELECT value FROM settings WHERE key = $1 AND city = $2 LIMIT 1", ["trainer_prompt", normalizedCity]);
  if (existingPrompt.rowCount === 0) {
    await db.query("INSERT INTO settings (key, value, city, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (key, city) DO NOTHING", ["trainer_prompt", defaultTrainerPrompt, normalizedCity]);
  }

  const hasAnyObjections = await db.query("SELECT COUNT(*)::int AS count FROM objections WHERE city = $1", [normalizedCity]);
  if (Number(hasAnyObjections.rows[0]?.count || 0) > 0) return;

  const krasnodarRows = await db.query("SELECT title, objection_text, coach_hint, stage, difficulty, is_active, is_required FROM objections WHERE city = $1 ORDER BY id ASC", ["Краснодар"]);
  const sourceRows = (krasnodarRows.rowCount ?? 0) > 0
    ? krasnodarRows.rows
    : defaultObjectionSeeds.map((objection) => ({
        title: objection.title,
        objection_text: objection.objectionText,
        coach_hint: objection.coachHint ?? getDefaultCoachHint(objection.stage),
        stage: objection.stage,
        difficulty: objection.difficulty,
        is_active: Boolean(objection.isActive),
        is_required: Boolean(objection.isRequired ?? 0),
      }));

  for (const row of sourceRows) {
    await db.query(
      `INSERT INTO objections (title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [String(row.title), String(row.objection_text), String(row.coach_hint ?? ""), String(row.stage), String(row.difficulty), Boolean(row.is_active), Boolean(row.is_required), normalizedCity],
    );
  }
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

export async function createAdminUser(input: { city: string; email: string; password: string; name?: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedCity = input.city.trim();
  const normalizedName = input.name?.trim() || normalizedCity;
  if (!normalizedCity) throw new Error("Укажите город.");
  if (await getUserByEmail(normalizedEmail)) throw new Error("Пользователь с таким email уже существует.");

  await getPool().query(
    "INSERT INTO users (email, password_hash, role, name, city, status) VALUES ($1, $2, 'admin', $3, $4, 'active')",
    [normalizedEmail, hashPassword(input.password), normalizedName, normalizedCity],
  );

  await ensureCityData(normalizedCity);
  return getUserByEmail(normalizedEmail);
}

export async function createManagerInvite(input: { city: string; email?: string }) {
  const city = input.city.trim();
  if (!city) throw new Error("Укажите город для инвайта.");
  const code = randomBytes(6).toString("hex").toUpperCase();
  await getPool().query("INSERT INTO manager_invites (code, city, email) VALUES ($1, $2, $3)", [code, city, input.email?.trim().toLowerCase() || null]);
  return { code, city, email: input.email?.trim().toLowerCase() || null };
}

export async function listAdminAccounts(city: string) {
  const result = await getPool().query(
    `SELECT u.id, u.name, u.email, u.city, u.status, u.created_at, COUNT(ts.id) AS training_count, MAX(ts.completed_at) AS last_training_at
     FROM users u
     LEFT JOIN training_sessions ts ON ts.admin_user_id = u.id AND ts.city = u.city
     WHERE u.role = 'admin' AND u.city = $1
     GROUP BY u.id, u.name, u.email, u.city, u.status, u.created_at
     ORDER BY u.created_at DESC`,
    [city],
  );
  return result.rows as Array<Record<string, unknown>>;
}

export async function setAdminStatus(id: number, city: string, status: "active" | "disabled") {
  await getPool().query("UPDATE users SET status = $1 WHERE id = $2 AND city = $3 AND role = 'admin'", [status, id, city]);
  return listAdminAccounts(city);
}

export async function resetAdminPassword(id: number, city: string, password: string) {
  await getPool().query("UPDATE users SET password_hash = $1 WHERE id = $2 AND city = $3 AND role = 'admin'", [hashPassword(password), id, city]);
  return true;
}

export async function deleteAdminAccount(id: number, city: string) {
  await getPool().query("DELETE FROM users WHERE id = $1 AND city = $2 AND role = 'admin'", [id, city]);
  return listAdminAccounts(city);
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
    "INSERT INTO users (email, password_hash, role, name, city, status) VALUES ($1, $2, 'manager', $3, $4, 'active')",
    [normalizedEmail, hashPassword(input.password), normalizedCity, normalizedCity],
  );
  await getPool().query("UPDATE manager_invites SET is_used = TRUE, used_at = NOW() WHERE code = $1", [normalizedCode]);
  await ensureCityData(normalizedCity);
  return getUserByEmail(normalizedEmail);
}

export async function listObjections(city: string) {
  const result = await getPool().query("SELECT * FROM objections WHERE city = $1 ORDER BY is_required DESC, is_active DESC, updated_at DESC, id DESC", [city]);
  return result.rows.map((row) => normalizeObjection(row as DbRow));
}

export async function listActiveObjections(city: string) {
  const result = await getPool().query("SELECT * FROM objections WHERE is_active = TRUE AND city = $1 ORDER BY is_required DESC, id DESC", [city]);
  return result.rows.map((row) => normalizeObjection(row as DbRow));
}

export async function getObjectionsByIds(ids: number[], city?: string) {
  if (!ids.length) return [];
  const values: unknown[] = [ids];
  let query = "SELECT * FROM objections WHERE id = ANY($1::int[])";
  if (city) {
    values.push(city);
    query += " AND city = $2";
  }
  query += " ORDER BY id ASC";
  const result = await getPool().query(query, values);
  const normalizedRows = result.rows.map((row) => normalizeObjection(row as DbRow));
  const rowsById = new Map(normalizedRows.map((row) => [row.id, row]));
  return ids.map((id) => rowsById.get(id)).filter((row): row is ObjectionRecord => Boolean(row));
}

export async function createObjection(input: { title: string; objectionText: string; coachHint: string; stage: string; difficulty: "easy" | "medium" | "hard"; isActive: boolean; isRequired: boolean; city: string; }) {
  const city = input.city.trim();
  await getPool().query(
    `INSERT INTO objections (title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [input.title.trim(), input.objectionText.trim(), input.coachHint.trim(), input.stage.trim(), input.difficulty, input.isActive, input.isRequired, city],
  );
  return listObjections(city);
}

export async function updateObjection(id: number, input: { title: string; objectionText: string; coachHint: string; stage: string; difficulty: "easy" | "medium" | "hard"; isActive: boolean; isRequired: boolean; city: string; }) {
  const city = input.city.trim();
  await getPool().query(
    `UPDATE objections SET title = $1, objection_text = $2, coach_hint = $3, stage = $4, difficulty = $5, is_active = $6, is_required = $7, updated_at = NOW()
     WHERE id = $8 AND city = $9`,
    [input.title.trim(), input.objectionText.trim(), input.coachHint.trim(), input.stage.trim(), input.difficulty, input.isActive, input.isRequired, id, city],
  );
  return listObjections(city);
}

export async function setObjectionActive(id: number, isActive: boolean, city: string) {
  await getPool().query("UPDATE objections SET is_active = $1, updated_at = NOW() WHERE id = $2 AND city = $3", [isActive, id, city]);
  return listObjections(city);
}

export async function setObjectionRequired(id: number, isRequired: boolean, city: string) {
  await getPool().query("UPDATE objections SET is_required = $1, updated_at = NOW() WHERE id = $2 AND city = $3", [isRequired, id, city]);
  return listObjections(city);
}

export async function deleteObjection(id: number, city: string) {
  await getPool().query("DELETE FROM objections WHERE id = $1 AND city = $2", [id, city]);
  return listObjections(city);
}

export async function createTrainingSession(input: { adminDisplayName: string; adminUserId?: number | null; city: string; scenario: ScenarioContext; trainerMode: TrainerMode; evaluationText: string; transcript: ChatMessage[]; startedAt: string; completedAt?: string; }) {
  const completedAt = input.completedAt || new Date().toISOString();
  await getPool().query(
    `INSERT INTO training_sessions (admin_display_name, admin_user_id, city, scenario_difficulty, step_count, trainer_mode, evaluation_text, score, transcript_json, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [input.adminDisplayName.trim(), input.adminUserId ?? null, input.city.trim(), input.scenario.difficulty, input.scenario.stepCount, input.trainerMode, input.evaluationText.trim(), extractTrainingScore(input.evaluationText), JSON.stringify(input.transcript), input.startedAt, completedAt],
  );
}

export async function listTrainingAdministrators(city: string) {
  const result = await getPool().query(
    `SELECT admin_display_name, COUNT(*) AS session_count, AVG(score) AS average_score, MAX(completed_at) AS last_completed_at
     FROM training_sessions
     WHERE city = $1
     GROUP BY admin_display_name
     ORDER BY last_completed_at DESC, admin_display_name ASC`,
    [city],
  );

  return result.rows.map((row) => ({
    adminDisplayName: String(row.admin_display_name),
    sessionCount: Number(row.session_count),
    averageScore: row.average_score == null ? null : Math.round(Number(row.average_score) * 10) / 10,
    lastCompletedAt: String(row.last_completed_at),
  })) satisfies TrainingAdministratorSummary[];
}

export async function listTrainingSessionsByAdministrator(adminDisplayName: string, city: string) {
  const result = await getPool().query(
    `SELECT * FROM training_sessions WHERE admin_display_name = $1 AND city = $2 ORDER BY completed_at DESC, id DESC`,
    [adminDisplayName, city],
  );
  return result.rows.map((row) => normalizeTrainingSession(row as DbRow));
}

export async function getTrainingSessionById(id: number, city?: string) {
  const result = city
    ? await getPool().query("SELECT * FROM training_sessions WHERE id = $1 AND city = $2 LIMIT 1", [id, city])
    : await getPool().query("SELECT * FROM training_sessions WHERE id = $1 LIMIT 1", [id]);

  return (result.rowCount ?? 0) > 0 ? normalizeTrainingSession(result.rows[0] as DbRow) : null;
}

export async function deleteTrainingSessionsById(ids: number[], city: string) {
  if (!ids.length) return 0;
  const result = await getPool().query("DELETE FROM training_sessions WHERE id = ANY($1::int[]) AND city = $2", [ids, city]);
  return Number(result.rowCount || 0);
}

export async function getSetting(key: string, city: string) {
  const result = await getPool().query("SELECT value FROM settings WHERE key = $1 AND city = $2 LIMIT 1", [key, city]);
  return result.rows[0]?.value ? String(result.rows[0].value) : "";
}

export async function setSetting(key: string, value: string, city: string) {
  await getPool().query(
    `INSERT INTO settings (key, value, city, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, city) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value.trim(), city],
  );
  return getSetting(key, city);
}
