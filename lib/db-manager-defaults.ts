import { getPool } from "@/lib/db-core";

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
    case "decision": return "Не спорьте в лоб: найдите истинную причину жесткого отказа и проверьте, можно ли вернуть клиентку в диалог через ценность и уместный следующий шаг.";
    case "timing": return "Поймите, это реальная временная пауза или мягкий отказ, и зафиксируйте конкретную точку возврата к разговору.";
    case "conditions": return "Разберите бытовой или организационный барьер и покажите, насколько он критичен для результата и комфорта клиентки.";
    case "trust": return "Снимайте недоверие фактами, конкретикой и спокойной прозрачной аргументацией без продавливания.";
    case "privacy": return "Уважайте границы клиентки и объясняйте, зачем нужны данные и как можно продолжить диалог без лишнего давления.";
    default: return "Уточняйте истинную причину сомнения и переводите разговор к ценности абонемента для клиентки.";
  }
}

function normalizeObjectionIdentity(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapSeedToDbRow(objection: ObjectionSeed) {
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

export function buildDefaultTrainerPrompt(city: string) {
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
    "- Ты сильный тренер по продажам LEVITA, а не методист и не нейтральный наблюдатель.",
    "- Давай разбор прямо, конкретно, по делу, без канцелярита.",
    "- Пиши так, будто разбираешь звонок или переписку сразу после контакта: что сработало, где администратор потерял клиентку, что надо было сказать иначе.",
    "- Не размазывай формулировки. Не используй пустые фразы вроде 'в целом неплохо' или 'есть точки роста' без конкретики.",
    "- Если ошибка была критичной — называй ее прямо: упустил, не дожал, рано ушел в аргументы, не вскрыл мотив, не перевел к шагу.",
    "",
    "🎯 Вердикт тренера:",
    "- Исход: купила / отказалась (указать абонемент; коротко напомнить, что абонемент действует во всех студиях города + онлайн-опция)",
    "- Почему так вышло: • … • … • …",
    "",
    "🧩 Разбор по ключевым навыкам:",
    "1) Выявление потребностей — сильная сторона / зона роста / провал | разбор: …",
    "2) Работа с возражениями — сильная сторона / зона роста / провал | разбор: …",
    "3) Аргументация выгоды — сильная сторона / зона роста / провал | разбор: …",
    "4) Удержание приоритета 144/96 — сильная сторона / зона роста / провал | разбор: …",
    "5) Перевод к шагу оплаты/брони — сильная сторона / зона роста / провал | разбор: …",
    "",
    "🧠 Что скажет тренер:",
    "- Что ты сделал хорошо: • … • …",
    "- Где ты потерял клиентку: • … • …",
    "- Что надо было сделать иначе: • … • …",
    "- Что сказать вместо этого (2–4 готовые фразы): «…», «…», «…»",
    "- Главный навык на следующую тренировку: …",
    "- Сильные фразы администратора: «…», «…», «…»",
    "",
    "🧍 Кто была клиентка в этом диалоге:",
    "- Возраст/профессия/график/доход/семья: …",
    "- Направление: …",
    `- Как смотрела на логистику по ${normalizedCity}/между студиями: …`,
    "- Главная цель и главный страх: …",
    "- Какие возражения реально прозвучали (мин. 5): «…», «…», «…», «…», «…»",
  ].join("\n");
}

export async function insertMissingObjectionsForOwner(input: { city: string; ownerEmail: string }) {
  const normalizedCity = input.city.trim();
  const normalizedOwnerEmail = input.ownerEmail.trim().toLowerCase();
  if (!normalizedCity || !normalizedOwnerEmail) return { inserted: 0, skipped: 0 };

  const db = getPool();
  const existing = await db.query("SELECT title, objection_text FROM objections WHERE owner_email = $1", [normalizedOwnerEmail]);
  const existingKeys = new Set(
    existing.rows.flatMap((row) => [
      normalizeObjectionIdentity(String(row.objection_text ?? "")),
      normalizeObjectionIdentity(String(row.title ?? "")),
    ]).filter(Boolean),
  );

  let inserted = 0;
  let skipped = 0;

  for (const row of defaultObjectionSeeds.map(mapSeedToDbRow)) {
    const textKey = normalizeObjectionIdentity(String(row.objection_text));
    const titleKey = normalizeObjectionIdentity(String(row.title));
    if ((textKey && existingKeys.has(textKey)) || (titleKey && existingKeys.has(titleKey))) {
      skipped += 1;
      continue;
    }

    await db.query(
      `INSERT INTO objections (title, objection_text, coach_hint, stage, difficulty, is_active, is_required, city, owner_email, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [String(row.title), String(row.objection_text), String(row.coach_hint ?? ""), String(row.stage), String(row.difficulty), Boolean(row.is_active), Boolean(row.is_required), normalizedCity, normalizedOwnerEmail],
    );

    if (textKey) existingKeys.add(textKey);
    if (titleKey) existingKeys.add(titleKey);
    inserted += 1;
  }

  return { inserted, skipped };
}

export async function ensureManagerData(input: { city: string; ownerEmail: string }) {
  const normalizedCity = input.city.trim();
  const normalizedOwnerEmail = input.ownerEmail.trim().toLowerCase();
  if (!normalizedCity || !normalizedOwnerEmail) return;

  const db = getPool();
  const existingPrompt = await db.query("SELECT value FROM settings WHERE key = $1 AND owner_email = $2 LIMIT 1", ["trainer_prompt", normalizedOwnerEmail]);
  if (existingPrompt.rowCount === 0) {
    await db.query(
      "INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (key, owner_email) DO NOTHING",
      ["trainer_prompt", buildDefaultTrainerPrompt(normalizedCity), normalizedCity, normalizedOwnerEmail],
    );
  }

  await insertMissingObjectionsForOwner({ city: normalizedCity, ownerEmail: normalizedOwnerEmail });
}

export async function ensureAllManagersHaveDefaultObjections() {
  const db = getPool();
  const result = await db.query("SELECT DISTINCT email, city FROM users WHERE role = 'manager' AND email IS NOT NULL AND city IS NOT NULL AND TRIM(city) <> '' ORDER BY email ASC");
  const summary: Array<{ ownerEmail: string; city: string; inserted: number; skipped: number }> = [];

  for (const row of result.rows) {
    const ownerEmail = String(row.email ?? "").trim().toLowerCase();
    const city = String(row.city ?? "").trim();
    if (!city || !ownerEmail) continue;
    await ensureManagerData({ city, ownerEmail });
    const sync = await insertMissingObjectionsForOwner({ city, ownerEmail });
    summary.push({ ownerEmail, city, inserted: sync.inserted, skipped: sync.skipped });
  }

  return summary;
}

export async function overwriteAllManagersWithDefaultTrainerPrompt() {
  const db = getPool();
  const result = await db.query("SELECT DISTINCT email, city FROM users WHERE role = 'manager' AND email IS NOT NULL AND city IS NOT NULL AND TRIM(city) <> '' ORDER BY email ASC");
  const summary: Array<{ ownerEmail: string; city: string }> = [];

  for (const row of result.rows) {
    const ownerEmail = String(row.email ?? "").trim().toLowerCase();
    const city = String(row.city ?? "").trim();
    if (!city || !ownerEmail) continue;

    await db.query(
      `INSERT INTO settings (key, value, city, owner_email, updated_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key, owner_email) DO UPDATE SET value = EXCLUDED.value, city = EXCLUDED.city, updated_at = NOW()`,
      ["trainer_prompt", buildDefaultTrainerPrompt(city), city, ownerEmail],
    );

    summary.push({ ownerEmail, city });
  }

  return summary;
}
