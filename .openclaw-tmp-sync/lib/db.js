"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = verifyPassword;
exports.ensureManagerData = ensureManagerData;
exports.ensureAllManagersHaveDefaultObjections = ensureAllManagersHaveDefaultObjections;
exports.overwriteAllManagersWithDefaultTrainerPrompt = overwriteAllManagersWithDefaultTrainerPrompt;
exports.getUserByEmail = getUserByEmail;
exports.getUserById = getUserById;
exports.createAdminUser = createAdminUser;
exports.createManagerInvite = createManagerInvite;
exports.listAdminAccounts = listAdminAccounts;
exports.setAdminStatus = setAdminStatus;
exports.resetAdminPassword = resetAdminPassword;
exports.deleteAdminAccount = deleteAdminAccount;
exports.createManagerUserFromInvite = createManagerUserFromInvite;
exports.listObjections = listObjections;
exports.listActiveObjections = listActiveObjections;
exports.getObjectionsByIds = getObjectionsByIds;
exports.createObjection = createObjection;
exports.updateObjection = updateObjection;
exports.setObjectionActive = setObjectionActive;
exports.setObjectionRequired = setObjectionRequired;
exports.deleteObjection = deleteObjection;
exports.createTrainingSession = createTrainingSession;
exports.listTrainingAdministrators = listTrainingAdministrators;
exports.listTrainingSessionsByAdministrator = listTrainingSessionsByAdministrator;
exports.getTrainingSessionById = getTrainingSessionById;
exports.deleteTrainingSessionsById = deleteTrainingSessionsById;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.listManagerInvites = listManagerInvites;
exports.listManagerAccounts = listManagerAccounts;
exports.setManagerStatus = setManagerStatus;
const node_crypto_1 = require("node:crypto");
const pg_1 = require("pg");
let pool = null;
function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL не задан.");
        }
        pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
    }
    return pool;
}
const defaultObjectionSeeds = [
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
    { title: "Не могу определиться, смотрю другие студии", objectionText: "Не могу определиться , все подходит , но хочу ещё посмотреть другие студии , уже записана на завтра туда", stage: "comparison", difficulty: "medium", isActive: 1 },
    { title: "Подвернула ногу", objectionText: "У меня сейчас нога травмирована ( подвернула ) , пока записываться никуда не буду", stage: "health", difficulty: "hard", isActive: 1 },
    { title: "Продолжим завтра", objectionText: "Сейчас не могу говорить , давайте завтра продолжим диалог", stage: "follow_up", difficulty: "easy", isActive: 1 },
    { title: "Посмотрю по самочувствию", objectionText: "надо посмотреть как буду чувствовать себя завтра", stage: "health", difficulty: "medium", isActive: 1 },
    { title: "Сама позвоню", objectionText: "я сама вам позвоню , все знаю , но сама , как дела закончатся", stage: "follow_up", difficulty: "medium", isActive: 1 },
    { title: "Завал на работе", objectionText: "С работой завал , как только появится время , сама напишу , работа 25/8", stage: "schedule", difficulty: "medium", isActive: 1 },
    { title: "Сначала к врачу", objectionText: "Я завтра записана к врачу ,мне надо у него узнать можно ли мне заниматься", stage: "health", difficulty: "hard", isActive: 1 },
    { title: "Надо посоветоваться с мужем из-за оплаты", objectionText: "Надо посоветоваться с мужем ,так как у меня нет карт и оформляю все на него", stage: "authority", difficulty: "hard", isActive: 1 },
    { title: "Позвоните после нового года", objectionText: "Много работы ,праздники скоро ,позвоните после нового года", stage: "follow_up", difficulty: "medium", isActive: 1 },
    { title: "Нашла студию по 100 рублей", objectionText: "500-600 рулей это дорого для одного занятия ,я нашла студию где тренировка стоит 100 рублей", stage: "price", difficulty: "hard", isActive: 1 },
    { title: "Нет личных шкафчиков", objectionText: "у вас нет шкафчиков личных", stage: "conditions", difficulty: "easy", isActive: 1 },
    { title: "Уже купила абонемент в спортзал", objectionText: "Я уже купила абонемент в спортзал ,там дешевле ", stage: "comparison", difficulty: "medium", isActive: 1 },
    { title: "Не вижу ценности переплаты", objectionText: "Дорого — не вижу, за что переплачивать.", stage: "price", difficulty: "hard", isActive: 1 },
    { title: "Оплачу завтра", objectionText: "я могу оплатить полностью не проблема ,только завтра", stage: "follow_up", difficulty: "easy", isActive: 1 },
    { title: "Начну с весны", objectionText: "Сейчас не могу заниматься ,начну с весны", stage: "timing", difficulty: "medium", isActive: 1 },
    { title: "Я не в Краснодаре", objectionText: "Я не в Краснодаре ,а вы мне про какие тренировки говорите ,я вам не буду отвечать больше", stage: "location", difficulty: "hard", isActive: 1 },
    { title: "Сначала спортзал, потом решу", objectionText: "я сначала схожу в спортзал на пробное и потом приму решение куда хочу больше ходить в бассейн или к вам", stage: "comparison", difficulty: "medium", isActive: 1 },
    { title: "Неактуально", objectionText: "мне больше неактуально ,не хочу заниматься", stage: "decision", difficulty: "medium", isActive: 1 },
    { title: "Уезжаю через 2 месяца", objectionText: "я уезжаю через 2 месяца ,хочу платить поразово", stage: "timing", difficulty: "medium", isActive: 1 },
    { title: "Сначала другую студию", objectionText: "надо сначала посмотреть студию другую,потом понять хочу я к вам нет", stage: "comparison", difficulty: "medium", isActive: 1 },
    { title: "Не будет рассрочек, поговорю с мужем", objectionText: "я знаю ,что у меня не будет рассрочек ,кредитов ,поэтому я поговорю с мужем и если он разрешит оформим на него", stage: "authority", difficulty: "hard", isActive: 1 },
    { title: "Подумать", objectionText: "Мне нужно подумать.", stage: "hesitation", difficulty: "medium", isActive: 1 },
    { title: "Нет времени из-за работы и детей", objectionText: "Нет времени из-за работы/детей.", stage: "schedule", difficulty: "medium", isActive: 1 },
    { title: "Неудобная локация", objectionText: "Далеко ездить, неудобная локация.", stage: "location", difficulty: "medium", isActive: 1 },
    { title: "Хочу сравнить студии", objectionText: "Хочу сравнить с другими студиями.", stage: "comparison", difficulty: "medium", isActive: 1 },
    { title: "Боюсь травм, спина и колени", objectionText: "Боюсь травм — слабая спина/колени.", stage: "health", difficulty: "hard", isActive: 1 },
    { title: "Слишком сложно", objectionText: "Слишком сложно, не получится повторять.", stage: "confidence", difficulty: "medium", isActive: 1 },
    { title: "Не уверена, что буду ходить регулярно", objectionText: "Не уверена, что буду ходить регулярно.", stage: "schedule", difficulty: "medium", isActive: 1 },
    { title: "Абонемент в другом зале", objectionText: "У меня уже есть абонемент в другом зале.", stage: "comparison", difficulty: "medium", isActive: 1 },
    { title: "Сначала похудею", objectionText: "Сначала похудею/подтянусь — потом приду.", stage: "confidence", difficulty: "medium", isActive: 1 },
    { title: "Партнёр против", objectionText: "Муж/партнёр против — считает это пустой тратой.", stage: "authority", difficulty: "hard", isActive: 1 },
    { title: "Сенсорный дискомфорт", objectionText: "Сенсорный дискомфорт: не люблю зеркала и громкую музыку.", stage: "conditions", difficulty: "medium", isActive: 1 },
    { title: "Стесняюсь группы", objectionText: "Стесняюсь группы — боюсь, что будут смотреть/снимать.", stage: "confidence", difficulty: "medium", isActive: 1 },
    { title: "Медицинские нюансы", objectionText: "Медицинские нюансы: плоскостопие/сколиоз/после травмы.", stage: "health", difficulty: "hard", isActive: 1 },
    { title: "Беременность или послеродовой период", objectionText: "Беременность/послеродовой период — страшно навредить.", stage: "health", difficulty: "hard", isActive: 1 },
    { title: "Нестабильный доход", objectionText: "Нестабильный доход — не готова к помесячной оплате.", stage: "price", difficulty: "hard", isActive: 1 },
    { title: "Командировки и переезды", objectionText: "Частые командировки/переезды — абонемент «сгорит».", stage: "schedule", difficulty: "medium", isActive: 1 },
    { title: "Не устраивает расписание", objectionText: "Не устраивает расписание — нет моих окон утром/поздно.", stage: "schedule", difficulty: "medium", isActive: 1 },
    { title: "Не доверяю обещаниям", objectionText: "Не доверяю обещаниям — у всех одинаковый маркетинг.", stage: "trust", difficulty: "hard", isActive: 1 },
    { title: "Не хочу оставлять данные", objectionText: "Не хочу оставлять данные/вступать в чаты и рассылки.", stage: "privacy", difficulty: "medium", isActive: 1 },
];
function buildDefaultTrainerPrompt(city) {
    const normalizedCity = city.trim() || "вашего города";
    return [
        `Ты участвуешь в тренажере продаж LEVITA для ${normalizedCity}.`,
        "",
        "Ключевой контекст студии:",
        `- Город: ${normalizedCity}.`,
        `- В ${normalizedCity} студии LEVITA, и абонемент действует во всех студиях города.`,
        "- Онлайн-тренировки — это дополнительная возможность внутри купленного абонемента, а не отдельный тариф.",
        "- Направления студии: Барре, Боди-балет, Балетная подкачка, Растяжка, Пилатес, Стройные руки и прямая осанка, Здоровые стопы, Танцы народов мира, Классическая хореография, Партерная хореография.",
        "- Приоритет продажи: сначала администратор старается вести к 144 или 96 занятиям. Переход к 48 или 24 обычно происходит только при стойких возражениях по цене, сроку или уверенности.",
        "- Сетка абонементов:",
        " - 192 занятий — 112200 ₽ — 9350 ₽/мес",
        " - 144 занятий — 84150 ₽ — 7012 ₽/мес",
        " - 96 занятий — 56100 ₽ — 4675 ₽/мес",
        " - 48 занятий — 30690 ₽ — 5115 ₽/мес",
        " - 24 занятия — 16500 ₽ — 5500 ₽/мес",
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
        `- Ты можешь ссылаться на районы ${normalizedCity}, дорогу, пробки, удобство разных студий, онлайн-формат и личный график.`,
        "- Помни, что абонемент действует во всех студиях города, а онлайн — дополнительная опция в рамках абонемента.",
        "- Не придумывай факты, которых нет в этом промпте.",
        "- Твоя задача — реалистично проверить администратора на продаже абонемента после пробного занятия.",
        "",
        "[ОТЧЁТ ПОСЛЕ ДИАЛОГА — ШАБЛОН]",
        "Правило тона отчёта:",
        "- Это разбор навыков и следующий шаг, а не “приговор”.",
        "- Всегда начинай со сильных сторон.",
        "- Не используй уничижительные ярлыки (типа “плохо/ужасно/провал”). Описывай наблюдаемое поведение и его эффект.",
        "",
        "🎯 Итог:",
        "- Решение: купила / отказалась (указать абонемент; напомнить, что абонемент действует во всех студиях города + онлайн-опция)",
        "- Причины: • … • … • …",
        "",
        "🧩 Карта навыков (без суммы и без баллов — это “снимок” именно этой ситуации):",
        "Статусы:",
        "- Уверенно — было конкретно, уместно и двигало к решению",
        "- В развитии — были попытки, но не хватило глубины/конкретики/логики",
        "- Следующий шаг — почти не проявилось или мешало прогрессу",
        "",
        "1) Выявление потребностей — Уверенно / В развитии / Следующий шаг",
        "2) Работа с возражениями — Уверенно / В развитии / Следующий шаг",
        "3) Аргументация выгоды — Уверенно / В развитии / Следующий шаг",
        "4) Удержание приоритета 144/96 (этика) — Уверенно / В развитии / Следующий шаг",
        "5) Перевод к шагу оплаты/брони — Уверенно / В развитии / Следующий шаг",
        "",
        "🧠 Комментарий (максимально прикладной):",
        "- Что уже получилось (минимум 2 пункта): • … • …",
        "- Что усилить в следующий раз (1–3 пункта, как действия “спросить/уточнить/сказать/предложить”): • … • …",
        "- Главный фокус следующей тренировки (одно действие, которое даст максимум эффекта): …",
        "- Готовые формулировки (2–4 коротких варианта фраз, которые стоило сказать в этом диалоге): «…», «…», «…»",
        "- Фразы администратора, которые сработали: «…», «…», «…»",
        "",
        "🧍 Профиль клиента:",
        "- Возраст/профессия/график/доход/семья: …",
        "- Случайное направление: …",
        `- Как решала вопрос логистики по ${normalizedCity}/между студиями: …`,
        "- Цели/страхи: …",
        "- Использованные возражения (мин. 5): «…», «…», «…», «…», «…»",
    ].join("\n");
}
function getDefaultCoachHint(stage) {
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
        case "decision": return "Не спорьте в лоб: найдите истинную причину жесткого отказа и проверьте, можно ли вернуть клиентку в диалог через ценность и уместный следующий шаг.";
        case "timing": return "Поймите, это реальная временная пауза или мягкий отказ, и зафиксируйте конкретную точку возврата к разговору.";
        case "conditions": return "Разберите бытовой или организационный барьер и покажите, насколько он критичен для результата и комфорта клиентки.";
        case "trust": return "Снимайте недоверие фактами, конкретикой и спокойной прозрачной аргументацией без продавливания.";
        case "privacy": return "Уважайте границы клиентки и объясняйте, зачем нужны данные и как можно продолжить диалог без лишнего давления.";
        default: return "Уточняйте истинную причину сомнения и переводите разговор к ценности абонемента для клиентки.";
    }
}
function hashPassword(password) {
    const salt = (0, node_crypto_1.randomBytes)(16).toString("hex");
    const hash = (0, node_crypto_1.scryptSync)(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
function verifyPassword(password, passwordHash) {
    const [salt, storedHash] = passwordHash.split(":");
    if (!salt || !storedHash)
        return false;
    const derivedHash = (0, node_crypto_1.scryptSync)(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, "hex");
    if (storedBuffer.length !== derivedHash.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(storedBuffer, derivedHash);
}
function normalizeUser(row) {
    return {
        id: Number(row.id),
        email: String(row.email),
        passwordHash: String(row.password_hash),
        role: row.role,
        name: String(row.name),
        city: String(row.city ?? row.name ?? ""),
        managerEmail: row.manager_email ? String(row.manager_email) : null,
        status: String(row.status ?? "active"),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
}
function normalizeObjection(row) {
    return {
        id: Number(row.id),
        title: String(row.title),
        objectionText: String(row.objection_text),
        coachHint: String(row.coach_hint ?? ""),
        stage: String(row.stage),
        difficulty: row.difficulty,
        isActive: row.is_active ? 1 : 0,
        isRequired: row.is_required ? 1 : 0,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
}
function normalizeTrainingSession(row) {
    return {
        id: Number(row.id),
        adminDisplayName: String(row.admin_display_name),
        adminUserId: row.admin_user_id == null ? null : Number(row.admin_user_id),
        scenarioDifficulty: row.scenario_difficulty,
        stepCount: Number(row.step_count),
        trainerMode: row.trainer_mode,
        evaluationText: String(row.evaluation_text),
        score: row.score == null ? null : Number(row.score),
        transcript: JSON.parse(String(row.transcript_json)),
        startedAt: String(row.started_at),
        completedAt: String(row.completed_at),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
}
function extractTrainingScore(evaluationText) {
    const match = evaluationText.match(/Общая оценка:\s*(\d{1,2})/i) || evaluationText.match(/Оценка:\s*(\d{1,2})/i);
    if (!match)
        return null;
    const score = Number(match[1]);
    return Number.isFinite(score) ? score : null;
}
function normalizeObjectionIdentity(text) {
    return text
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[«»"'`]/g, "")
        .replace(/[—–-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function mapSeedToDbRow(objection) {
    return {
        title: objection.title,
        objection_text: objection.objectionText,
        coach_hint: objection.coachHint ?? getDefaultCoachHint(objection.stage),
        stage: objection.stage,
        difficulty: objection.difficulty,
        is_active: Boolean(objection.isActive),
        is_required: Boolean(objection.isRequired ?? 0),
    };
}
async function insertMissingObjectionsForOwner(input) {
    const normalizedCity = input.city.trim();
    const normalizedOwnerEmail = input.ownerEmail.trim().toLowerCase();
    if (!normalizedCity || !normalizedOwnerEmail)
        return { inserted: 0, skipped: 0 };
    const db = getPool();
    const existing = await db.query("SELECT title, objection_text FROM objections WHERE owner_email = $1", [normalizedOwnerEmail]);
    const existingKeys = new Set(existing.rows.flatMap((row) => [
        normalizeObjectionIdentity(String(row.objection_text ?? "")),
        normalizeObjectionIdentity(String(row.title ?? "")),
    ]).filter(Boolean));
    let inserted = 0;
    let skipped = 0;
    for (const row of defaultObjectionSeeds.map(mapSeedToDbRow)) {
        const textKey = normalizeObjectionIdentity(String(row.objection_text));
        const titleKey = normalizeObjectionIdentity(String(row.title));
        if ((textKey && existingKeys.has(textKey)) || (titleKey && existingKeys.has(titleKey))) {
            skipped += 1;
            continue;
        }
        await db.query(`INSERT INTO objections (title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, owner_email, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, [String(row.title), String(row.objection_text), String(row.coach_hint ?? ""), String(row.stage), String(row.difficulty), Boolean(row.is_active), Boolean(row.is_required), normalizedCity, normalizedOwnerEmail]);
        if (textKey)
            existingKeys.add(textKey);
        if (titleKey)
            existingKeys.add(titleKey);
        inserted += 1;
    }
    return { inserted, skipped };
}
async function ensureManagerData(input) {
    const normalizedCity = input.city.trim();
    const normalizedOwnerEmail = input.ownerEmail.trim().toLowerCase();
    if (!normalizedCity || !normalizedOwnerEmail)
        return;
    const db = getPool();
    const existingPrompt = await db.query("SELECT value FROM settings WHERE key = $1 AND owner_email = $2 LIMIT 1", ["trainer_prompt", normalizedOwnerEmail]);
    if (existingPrompt.rowCount === 0) {
        await db.query("INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (key, owner_email) DO NOTHING", ["trainer_prompt", buildDefaultTrainerPrompt(normalizedCity), normalizedCity, normalizedOwnerEmail]);
    }
    await insertMissingObjectionsForOwner({ city: normalizedCity, ownerEmail: normalizedOwnerEmail });
}
async function ensureAllManagersHaveDefaultObjections() {
    const db = getPool();
    const result = await db.query("SELECT DISTINCT email, city FROM users WHERE role = 'manager' AND email IS NOT NULL AND city IS NOT NULL AND TRIM(city) <> '' ORDER BY email ASC");
    const summary = [];
    for (const row of result.rows) {
        const ownerEmail = String(row.email ?? "").trim().toLowerCase();
        const city = String(row.city ?? "").trim();
        if (!city || !ownerEmail)
            continue;
        await ensureManagerData({ city, ownerEmail });
        const sync = await insertMissingObjectionsForOwner({ city, ownerEmail });
        summary.push({ ownerEmail, city, inserted: sync.inserted, skipped: sync.skipped });
    }
    return summary;
}
async function overwriteAllManagersWithDefaultTrainerPrompt() {
    const db = getPool();
    const result = await db.query("SELECT DISTINCT email, city FROM users WHERE role = 'manager' AND email IS NOT NULL AND city IS NOT NULL AND TRIM(city) <> '' ORDER BY email ASC");
    const summary = [];
    for (const row of result.rows) {
        const ownerEmail = String(row.email ?? "").trim().toLowerCase();
        const city = String(row.city ?? "").trim();
        if (!city || !ownerEmail)
            continue;
        await db.query(`INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key, owner_email) DO UPDATE SET value = EXCLUDED.value, city = EXCLUDED.city, updated_at = NOW()`, ["trainer_prompt", buildDefaultTrainerPrompt(city), city, ownerEmail]);
        summary.push({ ownerEmail, city });
    }
    return summary;
}
async function getOne(query, values = [], normalizer) {
    const result = await getPool().query(query, values);
    if (result.rowCount === 0)
        return null;
    return normalizer ? normalizer(result.rows[0]) : result.rows[0];
}
async function getUserByEmail(email) {
    return getOne("SELECT * FROM users WHERE email = $1 LIMIT 1", [email], normalizeUser);
}
async function getUserById(id) {
    return getOne("SELECT * FROM users WHERE id = $1 LIMIT 1", [id], normalizeUser);
}
async function createAdminUser(input) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedCity = input.city.trim();
    const normalizedName = input.name?.trim() || normalizedCity;
    const normalizedManagerEmail = input.managerEmail?.trim().toLowerCase() || null;
    if (!normalizedCity)
        throw new Error("Укажите город.");
    if (!normalizedManagerEmail)
        throw new Error("Не найден email руководителя для привязки администратора.");
    if (await getUserByEmail(normalizedEmail))
        throw new Error("Пользователь с таким email уже существует.");
    await getPool().query("INSERT INTO users (email, password_hash, role, name, city, manager_email, status) VALUES ($1, $2, 'admin', $3, $4, $5, 'active')", [normalizedEmail, hashPassword(input.password), normalizedName, normalizedCity, normalizedManagerEmail]);
    await ensureManagerData({ city: normalizedCity, ownerEmail: normalizedManagerEmail });
    return getUserByEmail(normalizedEmail);
}
async function createManagerInvite(input) {
    const city = input.city.trim();
    if (!city)
        throw new Error("Укажите город для инвайта.");
    const code = (0, node_crypto_1.randomBytes)(6).toString("hex").toUpperCase();
    await getPool().query("INSERT INTO manager_invites (code, city, email) VALUES ($1, $2, $3)", [code, city, input.email?.trim().toLowerCase() || null]);
    return { code, city, email: input.email?.trim().toLowerCase() || null };
}
async function listAdminAccounts(ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query(`SELECT u.id, u.name, u.email, u.city, u.status, u.created_at, COUNT(ts.id) AS training_count, MAX(ts.completed_at) AS last_training_at
     FROM users u
     LEFT JOIN training_sessions ts ON ts.admin_user_id = u.id AND ts.owner_email = $1
     WHERE u.role = 'admin' AND u.manager_email = $1
     GROUP BY u.id, u.name, u.email, u.city, u.status, u.created_at
     ORDER BY u.created_at DESC`, [normalizedOwnerEmail]);
    return result.rows;
}
async function setAdminStatus(id, ownerEmail, status) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query("UPDATE users SET status = $1 WHERE id = $2 AND manager_email = $3 AND role = 'admin'", [status, id, normalizedOwnerEmail]);
    return listAdminAccounts(normalizedOwnerEmail);
}
async function resetAdminPassword(id, ownerEmail, password) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query("UPDATE users SET password_hash = $1 WHERE id = $2 AND manager_email = $3 AND role = 'admin'", [hashPassword(password), id, normalizedOwnerEmail]);
    return true;
}
async function deleteAdminAccount(id, ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query("DELETE FROM users WHERE id = $1 AND manager_email = $2 AND role = 'admin'", [id, normalizedOwnerEmail]);
    return listAdminAccounts(normalizedOwnerEmail);
}
async function createManagerUserFromInvite(input) {
    const normalizedCode = input.code.trim().toUpperCase();
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedCity = input.city.trim();
    const invite = await getOne("SELECT * FROM manager_invites WHERE code = $1 LIMIT 1", [normalizedCode]);
    if (!invite)
        throw new Error("Инвайт-код не найден.");
    if (Boolean(invite.is_used))
        throw new Error("Этот инвайт-код уже использован.");
    if (invite.email && String(invite.email).toLowerCase() !== normalizedEmail)
        throw new Error("Этот инвайт-код привязан к другому email.");
    if (!normalizedCity)
        throw new Error("Укажите город.");
    if (await getUserByEmail(normalizedEmail))
        throw new Error("Пользователь с таким email уже существует.");
    await getPool().query("INSERT INTO users (email, password_hash, role, name, city, manager_email, status) VALUES ($1, $2, 'manager', $3, $4, $5, 'active')", [normalizedEmail, hashPassword(input.password), normalizedCity, normalizedCity, normalizedEmail]);
    await getPool().query("UPDATE manager_invites SET is_used = TRUE, used_at = NOW() WHERE code = $1", [normalizedCode]);
    await ensureManagerData({ city: normalizedCity, ownerEmail: normalizedEmail });
    return getUserByEmail(normalizedEmail);
}
async function listObjections(ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query("SELECT * FROM objections WHERE owner_email = $1 ORDER BY is_required DESC, is_active DESC, updated_at DESC, id DESC", [normalizedOwnerEmail]);
    return result.rows.map((row) => normalizeObjection(row));
}
async function listActiveObjections(ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query("SELECT * FROM objections WHERE is_active = TRUE AND owner_email = $1 ORDER BY is_required DESC, id DESC", [normalizedOwnerEmail]);
    return result.rows.map((row) => normalizeObjection(row));
}
async function getObjectionsByIds(ids, ownerEmail) {
    if (!ids.length)
        return [];
    const values = [ids];
    let query = "SELECT * FROM objections WHERE id = ANY($1::int[])";
    if (ownerEmail) {
        values.push(ownerEmail.trim().toLowerCase());
        query += " AND owner_email = $2";
    }
    query += " ORDER BY id ASC";
    const result = await getPool().query(query, values);
    const normalizedRows = result.rows.map((row) => normalizeObjection(row));
    const rowsById = new Map(normalizedRows.map((row) => [row.id, row]));
    return ids.map((id) => rowsById.get(id)).filter((row) => Boolean(row));
}
async function createObjection(input) {
    const city = input.city.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    await getPool().query(`INSERT INTO objections (title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, owner_email, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, [input.title.trim(), input.objectionText.trim(), input.coachHint.trim(), input.stage.trim(), input.difficulty, input.isActive, input.isRequired, city, ownerEmail]);
    return listObjections(ownerEmail);
}
async function updateObjection(id, input) {
    const city = input.city.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    await getPool().query(`UPDATE objections SET title = $1, objection_text = $2, coach_hint = $3, stage = $4, difficulty = $5, is_active = $6, is_required = $7, city = $8, updated_at = NOW()
     WHERE id = $9 AND owner_email = $10`, [input.title.trim(), input.objectionText.trim(), input.coachHint.trim(), input.stage.trim(), input.difficulty, input.isActive, input.isRequired, city, id, ownerEmail]);
    return listObjections(ownerEmail);
}
async function setObjectionActive(id, isActive, ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query("UPDATE objections SET is_active = $1, updated_at = NOW() WHERE id = $2 AND owner_email = $3", [isActive, id, normalizedOwnerEmail]);
    return listObjections(normalizedOwnerEmail);
}
async function setObjectionRequired(id, isRequired, ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query("UPDATE objections SET is_required = $1, updated_at = NOW() WHERE id = $2 AND owner_email = $3", [isRequired, id, normalizedOwnerEmail]);
    return listObjections(normalizedOwnerEmail);
}
async function deleteObjection(id, ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query("DELETE FROM objections WHERE id = $1 AND owner_email = $2", [id, normalizedOwnerEmail]);
    return listObjections(normalizedOwnerEmail);
}
async function createTrainingSession(input) {
    const completedAt = input.completedAt || new Date().toISOString();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    await getPool().query(`INSERT INTO training_sessions (admin_display_name, admin_user_id, city, owner_email, scenario_difficulty, step_count, trainer_mode, evaluation_text, score, transcript_json, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [input.adminDisplayName.trim(), input.adminUserId ?? null, input.city.trim(), ownerEmail, input.scenario.difficulty, input.scenario.stepCount, input.trainerMode, input.evaluationText.trim(), extractTrainingScore(input.evaluationText), JSON.stringify(input.transcript), input.startedAt, completedAt]);
}
async function listTrainingAdministrators(ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query(`SELECT admin_display_name, COUNT(*) AS session_count, AVG(score) AS average_score, MAX(completed_at) AS last_completed_at
     FROM training_sessions
     WHERE owner_email = $1
     GROUP BY admin_display_name
     ORDER BY last_completed_at DESC, admin_display_name ASC`, [normalizedOwnerEmail]);
    return result.rows.map((row) => ({
        adminDisplayName: String(row.admin_display_name),
        sessionCount: Number(row.session_count),
        averageScore: row.average_score == null ? null : Math.round(Number(row.average_score) * 10) / 10,
        lastCompletedAt: String(row.last_completed_at),
    }));
}
async function listTrainingSessionsByAdministrator(adminDisplayName, ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query(`SELECT * FROM training_sessions WHERE admin_display_name = $1 AND owner_email = $2 ORDER BY completed_at DESC, id DESC`, [adminDisplayName, normalizedOwnerEmail]);
    return result.rows.map((row) => normalizeTrainingSession(row));
}
async function getTrainingSessionById(id, ownerEmail) {
    const result = ownerEmail
        ? await getPool().query("SELECT * FROM training_sessions WHERE id = $1 AND owner_email = $2 LIMIT 1", [id, ownerEmail.trim().toLowerCase()])
        : await getPool().query("SELECT * FROM training_sessions WHERE id = $1 LIMIT 1", [id]);
    return (result.rowCount ?? 0) > 0 ? normalizeTrainingSession(result.rows[0]) : null;
}
async function deleteTrainingSessionsById(ids, ownerEmail) {
    if (!ids.length)
        return 0;
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query("DELETE FROM training_sessions WHERE id = ANY($1::int[]) AND owner_email = $2", [ids, normalizedOwnerEmail]);
    return Number(result.rowCount || 0);
}
async function getSetting(key, ownerEmail) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const result = await getPool().query("SELECT value FROM settings WHERE key = $1 AND owner_email = $2 LIMIT 1", [key, normalizedOwnerEmail]);
    return result.rows[0]?.value ? String(result.rows[0].value) : "";
}
async function setSetting(key, value, ownerEmail, city) {
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    await getPool().query(`INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key, owner_email) DO UPDATE SET value = EXCLUDED.value, city = EXCLUDED.city, updated_at = NOW()`, [key, value.trim(), city.trim(), normalizedOwnerEmail]);
    return getSetting(key, normalizedOwnerEmail);
}
async function listManagerInvites() {
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
async function listManagerAccounts() {
    const result = await getPool().query(`SELECT id, name, email, city, status, created_at FROM users WHERE role = 'manager' ORDER BY created_at DESC, id DESC`);
    return result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        email: String(row.email),
        city: String(row.city ?? row.name ?? ''),
        status: String(row.status ?? 'active'),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
}
async function setManagerStatus(id, status) {
    await getPool().query("UPDATE users SET status = $1 WHERE id = $2 AND role = 'manager'", [status, id]);
    return listManagerAccounts();
}
