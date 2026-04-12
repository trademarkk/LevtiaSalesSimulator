import OpenAI from "openai";

import { getObjectionsByIds, getSetting, listActiveObjections } from "@/lib/db";
import type {
  ChatMessage,
  ChatPhase,
  ObjectionRecord,
  ScenarioContext,
  ScenarioDifficulty,
  TrainerMode,
  TrainingState,
} from "@/lib/types";

const encoder = new TextEncoder();
const MIN_STEP_COUNT = 15;
const TEST_STEP_COUNT = 3;
const MAX_STEP_COUNT = 35;
const DEFAULT_STEP_COUNT = 20;

const personas = [
  {
    persona:
      "Анна, 31 год. Работает в офисе, хочет красивую осанку и больше энергии, но считает расходы очень взвешенно.",
    speechStyle: "говорит спокойно, рационально, без лишних эмоций, любит конкретику",
    temperament: "сдержанная и рассудительная",
    lessonDirection: "барре",
    lessonImpression:
      "Пробное понравилось, атмосфера зацепила, тренер произвел хорошее впечатление.",
    purchaseSignal:
      "Клиентке важно почувствовать, что это забота о себе, а не импульсивная трата.",
  },
  {
    persona:
      "Екатерина, 27 лет. Никогда не занималась балетом, давно мечтает тянуться на шпагат, но стесняется своего уровня.",
    speechStyle: "говорит мягко, немного неуверенно, иногда через неловкость и сомнение",
    temperament: "тревожная, но открытая",
    lessonDirection: "растяжка",
    lessonImpression:
      "После пробного вдохновилась, но переживает, что не справится и быстро выпадет из процесса.",
    purchaseSignal:
      "Хочет поддержки и уверенности, что ее не будут сравнивать с другими.",
  },
  {
    persona:
      "Мария, 36 лет. Мама двоих детей, ищет формат для восстановления ресурса и женского состояния, но живет в очень плотном графике.",
    speechStyle: "говорит по делу, по-бытовому, часто через призму усталости и нехватки времени",
    temperament: "уставшая, но доброжелательная",
    lessonDirection: "пилатес",
    lessonImpression:
      "Пробное занятие дало приятные эмоции, но она сомневается, сможет ли встроить занятия в неделю.",
    purchaseSignal:
      "Для покупки ей нужен реалистичный сценарий по времени и регулярности.",
  },
  {
    persona:
      "Ольга, 42 года. Работает в продажах, много стоит и устает к вечеру, хочет подтянуть тело и снять напряжение со спины.",
    speechStyle: "говорит уверенно, местами сухо и с недоверием, любит, когда не льют воду",
    temperament: "собранная и требовательная",
    lessonDirection: "здоровая спина",
    lessonImpression:
      "На пробном почувствовала, что нагрузка мягкая и приятная, но пока не уверена, что будет видеть результат.",
    purchaseSignal:
      "Ей важно понять, что тренировки реально помогут самочувствию и осанке, а не просто дадут разовый приятный эффект.",
  },
  {
    persona:
      "Дарья, 24 года. Любит красивую подачу и эстетику, хочет заниматься для фигуры и удовольствия, но быстро остывает, если скучно.",
    speechStyle: "говорит живо, эмоционально, легче выражает впечатления, чем чёткие решения",
    temperament: "эмоциональная и импульсивная",
    lessonDirection: "боди-балет",
    lessonImpression:
      "Пробное показалось красивым и необычным, но она пока сомневается, что удержит дисциплину.",
    purchaseSignal:
      "Ей нужен эмоциональный отклик, ощущение, что формат вдохновляет и в него захочется возвращаться.",
  },
];

function pickRandomItems<T>(items: T[], count: number) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
  }

  return copy.slice(0, Math.max(1, Math.min(count, copy.length)));
}

function getTranscript(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Клиентка" : "Администратор"}: ${message.content}`)
    .join("\n");
}

function analyzeLastAdminMessage(messages: ChatMessage[]) {
  const lastAdminMessage = messages.filter((message) => message.role === "user").at(-1)?.content?.trim() ?? "";
  const normalized = lastAdminMessage.toLowerCase();
  const asksQuestion = lastAdminMessage.includes("?") || /^(а|и|то есть|скажите|подскажите|когда|почему|какой|какая|какие|где|зачем|сколько|можно ли|вам удобно|тебе удобно)/i.test(lastAdminMessage);

  const topics = [
    /дорог|цен|оплат|рассроч/.test(normalized) ? "цена/оплата" : null,
    /распис|время|утр|вечер|график/.test(normalized) ? "расписание/время" : null,
    /муж|партнер|карта|оформ/.test(normalized) ? "согласование/оформление" : null,
    /травм|врач|здоров|спин|колен/.test(normalized) ? "здоровье/ограничения" : null,
    /далек|ехать|локац/.test(normalized) ? "локация/дорога" : null,
    /цель|хочется|зачем|результат/.test(normalized) ? "цель/результат" : null,
  ].filter(Boolean) as string[];

  return {
    lastAdminMessage,
    asksQuestion,
    topics,
  };
}

function getObjectionPoolByDifficulty(
  objections: ObjectionRecord[],
  difficulty: ScenarioDifficulty,
  stepCount: number,
) {
  const required = objections.filter((item) => item.isRequired);
  const primary = objections.filter((item) => item.difficulty === difficulty && !item.isRequired);
  const secondary =
    difficulty === "easy"
      ? objections.filter((item) => item.difficulty === "medium" && !item.isRequired)
      : difficulty === "medium"
        ? objections.filter((item) => item.difficulty !== "hard" && !item.isRequired)
        : objections.filter((item) => item.difficulty !== "easy" && !item.isRequired);

  const unique = [...required, ...primary];

  for (const objection of secondary) {
    if (!unique.some((item) => item.id === objection.id)) {
      unique.push(objection);
    }
  }

  if (unique.length >= stepCount) {
    return unique;
  }

  for (const objection of objections) {
    if (!unique.some((item) => item.id === objection.id)) {
      unique.push(objection);
    }
  }

  return unique;
}

export async function buildScenario(options?: {
  city?: string;
  ownerEmail?: string;
  difficulty?: ScenarioDifficulty;
  stepCount?: number;
}) {
  const ownerEmail = options?.ownerEmail?.trim().toLowerCase();
  if (!ownerEmail) {
    throw new Error("Не найден владелец сценария для загрузки возражений.");
  }

  const activeObjections = await listActiveObjections(ownerEmail);

  if (activeObjections.length === 0) {
    throw new Error("Нет активных возражений для тренировки.");
  }

  const difficulty = options?.difficulty || "medium";
  const rawStepCount = options?.stepCount || DEFAULT_STEP_COUNT;
  const requestedStepCount = rawStepCount === TEST_STEP_COUNT
    ? TEST_STEP_COUNT
    : Math.max(MIN_STEP_COUNT, Math.min(MAX_STEP_COUNT, rawStepCount));
  const stepCount = Math.min(requestedStepCount, activeObjections.length);
  const objectionPool = getObjectionPoolByDifficulty(activeObjections, difficulty, stepCount);

  if (objectionPool.length === 0) {
    throw new Error("Для выбранной сложности не найдено подходящих возражений.");
  }

  const selectedObjections = pickRandomItems(objectionPool, stepCount);
  const selectedPersona = personas[Math.floor(Math.random() * personas.length)];

  return {
    city: options?.city || "Краснодар",
    ownerEmail,
    objectionIds: selectedObjections.map((objection) => objection.id),
    persona: selectedPersona.persona,
    speechStyle: selectedPersona.speechStyle,
    temperament: selectedPersona.temperament,
    lessonDirection: selectedPersona.lessonDirection,
    lessonImpression: selectedPersona.lessonImpression,
    purchaseSignal: selectedPersona.purchaseSignal,
    difficulty,
    stepCount,
  } satisfies ScenarioContext;
}

function getTurnPhaseGuidance(stepCount: number, turnNumber: number) {
  const earlyBoundary = Math.max(5, Math.floor(stepCount * 0.35));
  const lateBoundary = Math.max(stepCount - 5, Math.floor(stepCount * 0.8));

  if (turnNumber <= earlyBoundary) {
    return "Это ранняя часть длинного диалога. Сохраняй заметную дистанцию, не принимай решение и не смягчайся слишком быстро.";
  }

  if (turnNumber >= lateBoundary && turnNumber === stepCount) {
    return "Это финальная реплика клиентки перед последним ответом администратора. Дай решающее сомнение, уточнение или условие, но не подводи итог и не соглашайся заранее.";
  }

  if (turnNumber >= lateBoundary) {
    return "Это поздняя часть диалога. Можно становиться мягче только если администратор действительно снял прошлые сомнения конкретно и без давления.";
  }

  return "Это середина диалога. Сохраняй интерес к студии, но продолжай проверять администратора вопросами, уточнениями и реалистичными сомнениями.";
}

export async function buildConversationPrompt(input: {
  scenario: ScenarioContext;
  currentObjection: ObjectionRecord;
  messages: ChatMessage[];
  turnNumber: number;
  trainingState?: TrainingState;
}) {
  const { scenario, currentObjection, messages, turnNumber, trainingState } = input;
  const basePrompt = getSetting("trainer_prompt", scenario.ownerEmail || "");
  const transcript = getTranscript(messages);
  const lastAdminAnalysis = analyzeLastAdminMessage(messages);

  const finalPrompt = [
    "Ты играешь только роль клиентки студии балета и растяжки LEVITA после пробного занятия.",
    basePrompt,
    "",
    "Главная задача этого ответа: вернуть только следующую реплику клиентки в живом чате.",
    `Сценарий длинный: ${scenario.stepCount} шагов. Распределяй сопротивление на всю дистанцию и не сдавайся раньше времени.`,
    getTurnPhaseGuidance(scenario.stepCount, turnNumber),
    "",
    "Детали клиентки:",
    scenario.persona,
    `Манера речи: ${scenario.speechStyle}`,
    `Темперамент: ${scenario.temperament}`,
    `Пробное занятие было по направлению: ${scenario.lessonDirection}`,
    `Впечатление после пробного: ${scenario.lessonImpression}`,
    `Что может склонить к покупке: ${scenario.purchaseSignal}`,
    `Выбранная сложность сценария: ${scenario.difficulty}`,
    scenario.difficulty === "easy"
      ? "Для легкой сложности используй очень простой, бытовой и естественный русский язык. В одной реплике — одно главное сомнение. Не склеивай деньги, график, пробки, пробное и другие причины в одну сложную фразу. Если сомневаешься, говори проще."
      : scenario.difficulty === "medium"
        ? "Для средней сложности можно сочетать основное сомнение с одним уточняющим вопросом, но речь должна оставаться естественной и живой."
        : "Для сложной сложности можно быть более цепкой, возвращаться к прошлым сомнениям и дольше держать дистанцию, но всё равно говорить по-человечески.",
    `Текущий ход клиентки: ${turnNumber} из ${scenario.stepCount}`,
    "",
    "Активное возражение этого хода:",
    `${currentObjection.title}: ${currentObjection.objectionText}`,
    currentObjection.coachHint ? `Внутренняя логика сомнения: ${currentObjection.coachHint}` : "",
    "",
    trainingState
      ? [
          "Текущее внутреннее состояние клиентки:",
          `- Главный барьер сейчас: ${trainingState.currentMainConcern}`,
          `- Уже частично снятые сомнения: ${trainingState.resolvedConcerns.join(", ") || "пока нет"}`,
          `- Нерешенные сомнения: ${trainingState.unresolvedConcerns.join(", ") || "пока нет"}`,
          `- Доверие к администратору: ${trainingState.trustLevel}/10`,
          `- Интерес к покупке: ${trainingState.interestLevel}/10`,
          `- Сопротивление: ${trainingState.resistanceLevel}/10`,
          `- Текущее настроение: ${trainingState.clientMood}`,
          `- Качество последнего ответа администратора: ${trainingState.lastAdminReplyQuality}`,
          `- Администратор в последней реплике задал вопрос: ${trainingState.lastAdminAskedQuestion ? "да" : "нет"}`,
          `- Тема последнего вопроса администратора: ${trainingState.lastAdminQuestionTopic || "не определена"}`,
          `- Клиентке сейчас обязательно ответить по существу: ${trainingState.shouldAnswerDirectly ? "да" : "нет"}`,
          `- Какой прямой ответ сейчас от неё ожидается: ${trainingState.pendingDirectAnswerTopic || "нет обязательного прямого ответа"}`,
          `- Срочность прямого ответа: ${trainingState.directAnswerUrgency}/10`,
          `- Предпочтительный стиль ответа сейчас: ${trainingState.preferredAnswerStyle}`,
          `- Что клиентка уже раскрыла о себе: ${trainingState.factsLearned.join(", ") || "пока почти ничего"}`,
          `- Динамика контакта: ${trainingState.rapportNotes.join(", ") || "контакт только формируется"}`,
          "",
        ].join("\n")
      : "",
    lastAdminAnalysis.lastAdminMessage
      ? [
          "Последняя реплика администратора:",
          lastAdminAnalysis.lastAdminMessage,
          lastAdminAnalysis.asksQuestion
            ? "Администратор задал прямой вопрос. Клиентка должна сначала осмысленно ответить именно на него, а потом уже продолжить диалог своим сомнением, уточнением или реакцией. Нельзя игнорировать прямой вопрос администратора."
            : "Если в последней реплике администратора нет вопроса, клиентка может больше опираться на свое текущее сомнение и динамику диалога.",
          lastAdminAnalysis.topics.length
            ? `Темы, которые явно поднял администратор: ${lastAdminAnalysis.topics.join(", ")}.`
            : "",
          trainingState?.shouldAnswerDirectly
            ? `Сейчас у клиентки есть обязательство дать прямой ответ по теме: ${trainingState.pendingDirectAnswerTopic || trainingState.lastAdminQuestionTopic}.`
            : "",
          trainingState && trainingState.directAnswerUrgency >= 5
            ? "Сейчас нельзя уходить в абстрактные возражения раньше прямого ответа. Сначала ответ по сути, потом продолжение диалога."
            : "",
          trainingState?.preferredAnswerStyle === "direct_with_doubt"
            ? "Форма ответа сейчас: сначала прямой ответ по сути, затем мягкое сомнение или оговорка."
            : trainingState?.preferredAnswerStyle === "direct_with_question"
              ? "Форма ответа сейчас: сначала прямой ответ по сути, затем короткий встречный вопрос или уточнение."
              : trainingState?.preferredAnswerStyle === "direct_with_relief"
                ? "Форма ответа сейчас: сначала прямой ответ по сути, затем небольшое смягчение или облегчение, но без мгновенного согласия."
                : trainingState?.preferredAnswerStyle === "direct_with_emotion"
                  ? "Форма ответа сейчас: сначала прямой ответ по сути, затем живая эмоциональная реакция без театральности."
                  : "",
          "",
        ].join("\n")
      : "",
    transcript
      ? ["Текущий диалог:", transcript].join("\n")
      : "Диалог еще не начат. Сейчас нужно открыть тренировку первым сообщением клиентки.",
    "",
    "Жесткие правила ответа:",
    "1. Верни только одну следующую реплику клиентки и больше ничего.",
    "2. Не пиши за администратора, не продолжай диалог за обе стороны и не показывай весь сценарий целиком.",
    "3. Не используй префиксы вроде 'Клиентка:' или 'Администратор:'.",
    "4. Не добавляй списки, markdown, ремарки, кавычки вокруг текста и сценические указания.",
    "5. Пиши естественно, как в обычном чате: 1-3 коротких предложения.",
    "6. Не используй неуклюжие, слишком логические, книжные или синтетические формулировки. Реплика должна звучать так, как будто её реально написала живая клиентка в мессенджере.",
    "7. Сохраняй манеру речи и темперамент конкретной клиентки из сценария. Две разные клиентки не должны звучать одинаково.",
    "8. Не используй слово 'мы', если это не оправдано контекстом семьи или пары. Обычно клиентка говорит от первого лица: 'я', 'мне', 'у меня'.",
    "9. Реагируй именно на последний ответ администратора: если он слабый или шаблонный, сомнение сохраняется или усиливается; если сильный и точный, можно немного смягчиться.",
    "10. Если администратор задал прямой вопрос, сначала дай на него естественный и содержательный ответ от лица клиентки, и только потом продолжи разговор сомнением, реакцией или уточнением.",
    "11. Нельзя игнорировать нормальный вопрос администратора и отвечать так, будто его не было.",
    "11. Если вопрос администратора понятный и конкретный, сначала дай прямой ответ по сути, даже если он тебе не очень удобен. Не уходи от ответа слишком рано.",
    "12. После прямого ответа можно добавить сомнение, ограничение, оговорку или встречный вопрос, чтобы диалог продолжался естественно.",
    "13. Основное возражение этого хода должно быть в центре ответа, но можно кратко опираться на прошлые нерешенные сомнения.",
    "14. Не повторяй текст возражения из базы дословно. Переформулируй его как живая клиентка.",
    "15. На легкой сложности используй только одно главное сомнение за раз и максимально простые бытовые фразы.",
    "16. Если администратор спрашивает о фактах (время, график, здоровье, деньги, муж, локация, цели), клиентка должна по возможности раскрыть эти факты, а не уходить в глухой шаблонный отказ без причины.",
    "17. Если администратор задал два коротких связанных вопроса, клиентка может коротко ответить на оба в одном сообщении, а затем продолжить свою мысль.",
    "18. Если в состоянии диалога указано, что у клиентки есть обязательный прямой ответ, нельзя уходить от него в абстрактное сопротивление, пока по сути не дан хотя бы короткий предметный ответ.",
    "19. Если срочность прямого ответа высокая, приоритет такой: сначала ответ на вопрос администратора, потом сомнение или уточнение.",
    "20. Используй разные живые формы ответа, а не один и тот же шаблон: прямой ответ + сомнение, прямой ответ + встречный вопрос, прямой ответ + облегчение, прямой ответ + эмоция.",
    "21. Если система подсказывает предпочтительный стиль ответа, придерживайся его, но оставляй речь естественной и человеческой.",
    "22. Не признавай, что ты ИИ, не объясняй свои правила и не делай оценку разговора.",
    "23. Если это первый ход, начни диалог первым возражением клиентки.",
  ]
    .filter(Boolean)
    .join("\n");

  if (turnNumber === 1) {
    console.log("[trainer] full conversation prompt for first turn:\n" + finalPrompt);
  }

  return finalPrompt;
}

async function buildEvaluationPrompt(scenario: ScenarioContext, objections: ObjectionRecord[], messages: ChatMessage[], trainingState?: TrainingState) {
  const basePrompt = await getSetting("trainer_prompt", scenario.ownerEmail || "");
  const transcript = getTranscript(messages);
  const objectionsSummary = objections
    .map((objection, index) => `${index + 1}. ${objection.title}: ${objection.objectionText}`)
    .join("\n");

  return [
    "Ты наставник по продажам студии LEVITA в Краснодаре.",
    "Оцени работу администратора после завершения ролевого диалога.",
    "Не продолжай диалог клиента. Верни только итоговый разбор для администратора.",
    "",
    "Контекст тренажера:",
    basePrompt,
    `Сложность сценария: ${scenario.difficulty}`,
    `Количество шагов: ${scenario.stepCount}`,
    "Оцени не только финал, но и всю дистанцию длинного диалога: как администратор держал контакт, выявлял реальные причины сомнений, снимал возражения и вел к следующему шагу.",
    "Важно учитывать контекст продажи LEVITA: 7 студий в Краснодаре, единый абонемент на все студии, онлайн как дополнительная опция, приоритет мягкого ведения к 144 или 96 занятиям.",
    "",
    "Возражения сценария:",
    objectionsSummary,
    "",
    trainingState
      ? [
          "Финальное внутреннее состояние клиентки к концу тренировки:",
          `- Главный барьер: ${trainingState.currentMainConcern}`,
          `- Доверие: ${trainingState.trustLevel}/10`,
          `- Интерес: ${trainingState.interestLevel}/10`,
          `- Сопротивление: ${trainingState.resistanceLevel}/10`,
          `- Настроение: ${trainingState.clientMood}`,
          `- Снятые сомнения: ${trainingState.resolvedConcerns.join(", ") || "нет"}`,
          `- Нерешенные сомнения: ${trainingState.unresolvedConcerns.join(", ") || "нет"}`,
          "",
        ].join("\n")
      : "",
    "Диалог:",
    transcript,
    "",
    "Верни результат строго в формате:",
    "🎯 Итог:",
    "- Решение: купила / отказалась (если купила — какой формат или абонемент обсуждался).",
    "- Причины: 2-4 коротких пункта.",
    "",
    "🔢 Оценка администратора (0-10):",
    "1) Выявление потребностей — X/2",
    "2) Работа с возражениями — X/2",
    "3) Аргументация выгоды — X/2",
    "4) Удержание сильного предложения 144/96 без давления — X/2",
    "5) Перевод к оплате, брони или следующему шагу — X/2",
    "Общая оценка: N/10",
    "",
    "🧠 Комментарий:",
    "- Сильные стороны: 3-5 коротких пунктов.",
    "- Ошибки/упущения: 3-5 коротких пунктов.",
    "- Рекомендации: 4-6 конкретных формулировок, как отвечать сильнее.",
    "- Фразы администратора, которые сработали: 2-4 точные цитаты из диалога.",
    "",
    "🧍 Профиль клиента:",
    "- Цели/страхи/ограничения: коротко.",
    "- Какие возражения реально были использованы: не меньше 5, если они были в диалоге.",
    "- Что стало решающим фактором в решении клиентки.",
  ].join("\n");
}

function buildFallbackConversationReply(
  messages: ChatMessage[],
  objections: ObjectionRecord[],
  scenario: ScenarioContext,
  turnNumber: number,
) {
  const currentObjection = objections[Math.min(turnNumber - 1, objections.length - 1)];
  const lastUserMessage =
    messages.filter((message) => message.role === "user").at(-1)?.content.toLowerCase() ?? "";

  if (turnNumber === 1) {
    return `Мне у вас понравилось, но честно, ${currentObjection?.objectionText.toLowerCase() ?? scenario.purchaseSignal.toLowerCase()}`;
  }

  if (lastUserMessage.includes("рассроч") || lastUserMessage.includes("оплат")) {
    return "Если с оплатой можно решить комфортно, мне уже спокойнее. Но мне всё равно важно понять, не будет ли это для меня лишней нагрузкой по деньгам.";
  }

  if (lastUserMessage.includes("распис") || lastUserMessage.includes("время")) {
    return "По времени мне удобнее либо утром, либо уже вечером после работы. Если с этим получится, тогда диалог уже звучит реалистичнее для меня.";
  }

  if (lastUserMessage.includes("когда") || lastUserMessage.includes("во сколько") || lastUserMessage.includes("какое время")) {
    return "Мне чаще всего удобно либо утром до работы, либо уже вечером. Но я и переживаю как раз из-за того, что график у меня плавающий.";
  }

  if (lastUserMessage.includes("почему")) {
    return "Потому что я не хочу купить абонемент на эмоциях, а потом почувствовать, что он просто лежит без дела. Мне важно понять, что я реально буду ходить.";
  }

  if (lastUserMessage.includes("муж") || lastUserMessage.includes("партнер")) {
    return "Да, мне правда важно это обсудить дома. Я не люблю такие решения принимать в одну сторону, особенно если вопрос упирается в оплату.";
  }

  if (lastUserMessage.includes("травм") || lastUserMessage.includes("здоров") || lastUserMessage.includes("врач")) {
    return "У меня тут реально есть тревога за здоровье, не просто отговорка. Поэтому мне важно сначала понять, можно ли мне такую нагрузку без вреда.";
  }

  if (lastUserMessage.includes("далеко") || lastUserMessage.includes("ехать") || lastUserMessage.includes("добираться")) {
    return "Да, для меня дорога — это тоже фактор. Если ехать неудобно, я просто быстро начинаю сливать даже то, что поначалу нравится.";
  }

  return currentObjection?.objectionText ?? "Мне пока сложно принять решение сразу.";
}

function buildFallbackEvaluation(messages: ChatMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user");
  const score = Math.max(4, Math.min(9, 5 + userMessages.length));

  return [
    "🎯 Итог:",
    "- Решение: диалог завершен без уверенного закрытия, клиентка осталась в сомнениях.",
    "- Причины:",
    "- Не все реальные сомнения были раскрыты до конца.",
    "- Аргументы звучали не всегда достаточно предметно под ситуацию клиентки.",
    "",
    "🔢 Оценка администратора (0-10):",
    "1) Выявление потребностей — 1/2",
    "2) Работа с возражениями — 1/2",
    "3) Аргументация выгоды — 1/2",
    "4) Удержание сильного предложения 144/96 без давления — 1/2",
    "5) Перевод к оплате, брони или следующему шагу — 1/2",
    `Общая оценка: ${score}/10`,
    "",
    "🧠 Комментарий:",
    "- Сильные стороны:",
    "- Администратор не бросил диалог после первого сомнения.",
    "- В разговоре была попытка довести клиентку до следующего шага.",
    "- Ошибки/упущения:",
    "- Нужно глубже уточнять истинную причину сомнения, а не отвечать слишком общо.",
    "- Аргументы стоит сильнее привязывать к выгоде клиентки и ее личной ситуации.",
    "- Рекомендации:",
    "- Сначала коротко отразить сомнение клиентки.",
    "- Затем дать конкретный аргумент по ее ситуации.",
    "- Потом мягко перевести к следующему шагу.",
    "- Фразы администратора, которые сработали: если диалог короткий, выберите 1-2 самые удачные реплики вручную.",
    "",
    "🧍 Профиль клиента:",
    "- Цели/страхи/ограничения: есть интерес, но не хватает уверенности и ясности по формату.",
    "- Какие возражения реально были использованы: зависит от длины диалога.",
    "- Что стало решающим фактором в решении клиентки: недостаточная конкретика и не до конца снятые сомнения.",
  ].join("\n");
}

function createTextStream(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function isRecoverableProviderError(error: unknown) {
  const candidate = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  const message = candidate?.message?.toLowerCase() || "";
  const status = candidate?.status;

  return Boolean(
    status === 401 ||
      status === 402 ||
      status === 408 ||
      status === 409 ||
      status === 429 ||
      (typeof status === "number" && status >= 500) ||
      /rate limit|temporarily|timeout|overloaded|insufficient balance|quota|openrouter|deepseek/.test(message),
  );
}

function resolveProvider(): TrainerMode {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Укажите OPENROUTER_API_KEY, чтобы использовать OpenRouter.");
    }

    return "openrouter";
  }

  if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("Укажите DEEPSEEK_API_KEY, чтобы использовать DeepSeek.");
    }

    return "deepseek";
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Укажите OPENAI_API_KEY, чтобы использовать OpenAI.");
    }

    return "openai";
  }

  if (process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return "deepseek";
  }

  return "demo";
}

async function createOpenAiText(input: {
  systemPrompt: string;
  phase: ChatPhase;
  fallbackText?: string;
}) {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      reasoning: {
        effort: input.phase === "evaluation" ? "medium" : "low",
      },
      store: false,
      input: [
        {
          role: "developer",
          content: input.systemPrompt,
        },
      ],
    });

    const outputText = response.output_text.trim();

    if (!outputText) {
      throw new Error("OpenAI не вернул текст ответа.");
    }

    return outputText;
  } catch (error) {
    if (input.fallbackText && isRecoverableProviderError(error)) {
      console.warn("[trainer] OpenAI fallback engaged", error);
      return input.fallbackText;
    }

    throw error;
  }
}

async function createProviderStream(input: {
  provider: "deepseek" | "openrouter";
  systemPrompt: string;
  phase: ChatPhase;
  fallbackText?: string;
}) {
  const isOpenRouter = input.provider === "openrouter";

  const client = new OpenAI({
    apiKey: isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.DEEPSEEK_API_KEY,
    baseURL: isOpenRouter
      ? process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
      : process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    defaultHeaders: isOpenRouter
      ? {
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "LEVITA Sales Simulator",
        }
      : undefined,
  });

  let stream: Awaited<ReturnType<typeof client.chat.completions.create>>;

  try {
    stream = await client.chat.completions.create({
      model: isOpenRouter
        ? process.env.OPENROUTER_MODEL || "openrouter/free"
        : process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: input.phase === "evaluation" ? 0.4 : 0.8,
      stream: true,
      stop:
        input.phase === "conversation"
          ? ["\nАдминистратор", "\nКлиентка", "\nКлиент", "\nИтог:", "\nОценка:"]
          : undefined,
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
      ],
    });
  } catch (error) {
    if (input.fallbackText && isRecoverableProviderError(error)) {
      console.warn(`[trainer] ${input.provider} fallback engaged before stream start`, error);
      return createTextStream(input.fallbackText);
    }

    throw error;
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let emitted = false;

      try {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content ?? "";

          if (token) {
            emitted = true;
            controller.enqueue(encoder.encode(token));
          }
        }

        if (!emitted && input.fallbackText) {
          controller.enqueue(encoder.encode(input.fallbackText));
        }

        controller.close();
      } catch (error) {
        if (!emitted && input.fallbackText && isRecoverableProviderError(error)) {
          console.warn(`[trainer] ${input.provider} fallback engaged during stream`, error);
          controller.enqueue(encoder.encode(input.fallbackText));
          controller.close();
          return;
        }

        controller.error(error);
      }
    },
  });
}

export async function streamTrainerReply(input: {
  messages: ChatMessage[];
  scenario: ScenarioContext;
  trainingState?: TrainingState;
  phase: ChatPhase;
  turnNumber?: number;
}) {
  const { messages, scenario, trainingState, phase } = input;
  const objections = await getObjectionsByIds(scenario.objectionIds, scenario.ownerEmail);

  if (objections.length === 0) {
    throw new Error("Сценарий не найден в библиотеке возражений.");
  }

  const provider = resolveProvider();

  if (phase === "evaluation") {
    const fallbackEvaluation = buildFallbackEvaluation(messages);

    if (provider === "demo") {
      return {
        mode: "demo" as const,
        stream: createTextStream(fallbackEvaluation),
      };
    }

    const evaluationPrompt = await buildEvaluationPrompt(scenario, objections, messages, trainingState);

    if (provider === "openrouter") {
      return {
        mode: "openrouter" as const,
        stream: await createProviderStream({
          provider: "openrouter",
          systemPrompt: evaluationPrompt,
          phase,
          fallbackText: fallbackEvaluation,
        }),
      };
    }

    if (provider === "deepseek") {
      return {
        mode: "deepseek" as const,
        stream: await createProviderStream({
          provider: "deepseek",
          systemPrompt: evaluationPrompt,
          phase,
          fallbackText: fallbackEvaluation,
        }),
      };
    }

    return {
      mode: "openai" as const,
      stream: createTextStream(
        await createOpenAiText({
          systemPrompt: evaluationPrompt,
          phase,
          fallbackText: fallbackEvaluation,
        }),
      ),
    };
  }

  const turnNumber = Math.max(1, Math.min(scenario.stepCount, input.turnNumber || 1));
  const currentObjection = objections[Math.min(turnNumber - 1, objections.length - 1)];

  if (!currentObjection) {
    throw new Error("Не удалось определить текущее возражение сценария.");
  }

  const fallbackConversation = buildFallbackConversationReply(
    messages,
    objections,
    scenario,
    turnNumber,
  );

  if (provider === "demo") {
    return {
      mode: "demo" as const,
      stream: createTextStream(fallbackConversation),
    };
  }

  const conversationPrompt = await buildConversationPrompt({
    scenario,
    currentObjection,
    messages,
    turnNumber,
    trainingState,
  });

  if (provider === "openrouter") {
    return {
      mode: "openrouter" as const,
      stream: await createProviderStream({
        provider: "openrouter",
        systemPrompt: conversationPrompt,
        phase,
        fallbackText: fallbackConversation,
      }),
    };
  }

  if (provider === "deepseek") {
    return {
      mode: "deepseek" as const,
      stream: await createProviderStream({
        provider: "deepseek",
        systemPrompt: conversationPrompt,
        phase,
        fallbackText: fallbackConversation,
      }),
    };
  }

  return {
    mode: "openai" as const,
    stream: createTextStream(
      await createOpenAiText({
        systemPrompt: conversationPrompt,
        phase,
        fallbackText: fallbackConversation,
      }),
    ),
  };
}
