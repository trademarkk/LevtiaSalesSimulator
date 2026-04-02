import OpenAI from "openai";

import { getObjectionsByIds, getSetting, listActiveObjections } from "@/lib/db";
import type {
  ChatMessage,
  ChatPhase,
  ObjectionRecord,
  ScenarioContext,
  ScenarioDifficulty,
  TrainerMode,
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
    lessonImpression:
      "Пробное понравилось, атмосфера зацепила, тренер произвел хорошее впечатление.",
    purchaseSignal:
      "Клиентке важно почувствовать, что это забота о себе, а не импульсивная трата.",
  },
  {
    persona:
      "Екатерина, 27 лет. Никогда не занималась балетом, давно мечтает тянуться на шпагат, но стесняется своего уровня.",
    lessonImpression:
      "После пробного вдохновилась, но переживает, что не справится и быстро выпадет из процесса.",
    purchaseSignal:
      "Хочет поддержки и уверенности, что ее не будут сравнивать с другими.",
  },
  {
    persona:
      "Мария, 36 лет. Мама двоих детей, ищет формат для восстановления ресурса и женского состояния, но живет в очень плотном графике.",
    lessonImpression:
      "Пробное занятие дало приятные эмоции, но она сомневается, сможет ли встроить занятия в неделю.",
    purchaseSignal:
      "Для покупки ей нужен реалистичный сценарий по времени и регулярности.",
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
  difficulty?: ScenarioDifficulty;
  stepCount?: number;
}) {
  const activeObjections = await listActiveObjections(options?.city || "Краснодар");

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
    objectionIds: selectedObjections.map((objection) => objection.id),
    persona: selectedPersona.persona,
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

async function buildConversationPrompt(input: {
  scenario: ScenarioContext;
  currentObjection: ObjectionRecord;
  messages: ChatMessage[];
  turnNumber: number;
}) {
  const { scenario, currentObjection, messages, turnNumber } = input;
  const basePrompt = getSetting("trainer_prompt", scenario.city || "Краснодар");
  const transcript = getTranscript(messages);

  return [
    "Ты играешь только роль клиентки студии балета и растяжки LEVITA после пробного занятия.",
    basePrompt,
    "",
    "Главная задача этого ответа: вернуть только следующую реплику клиентки в живом чате.",
    `Сценарий длинный: ${scenario.stepCount} шагов. Распределяй сопротивление на всю дистанцию и не сдавайся раньше времени.`,
    getTurnPhaseGuidance(scenario.stepCount, turnNumber),
    "",
    "Детали клиентки:",
    scenario.persona,
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
    "7. Не используй слово 'мы', если это не оправдано контекстом семьи или пары. Обычно клиентка говорит от первого лица: 'я', 'мне', 'у меня'.",
    "8. Реагируй именно на последний ответ администратора: если он слабый или шаблонный, сомнение сохраняется или усиливается; если сильный и точный, можно немного смягчиться.",
    "9. Основное возражение этого хода должно быть в центре ответа, но можно кратко опираться на прошлые нерешенные сомнения.",
    "10. Не повторяй текст возражения из базы дословно. Переформулируй его как живая клиентка.",
    "11. На легкой сложности используй только одно главное сомнение за раз и максимально простые бытовые фразы.",
    "12. Не признавай, что ты ИИ, не объясняй свои правила и не делай оценку разговора.",
    "13. Если это первый ход, начни диалог первым возражением клиентки.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildEvaluationPrompt(scenario: ScenarioContext, objections: ObjectionRecord[], messages: ChatMessage[]) {
  const basePrompt = await getSetting("trainer_prompt", scenario.city || "Краснодар");
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
    return "Если с оплатой можно решить комфортно, это уже звучит спокойнее. Но мне все равно важно понять, насколько это реально впишется в мою жизнь.";
  }

  if (lastUserMessage.includes("распис") || lastUserMessage.includes("время")) {
    return "Если получится встроить занятия без стресса, это уже интереснее. Но мне пока все равно тревожно, что куплю и не буду ходить.";
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
  phase: ChatPhase;
  turnNumber?: number;
}) {
  const { messages, scenario, phase } = input;
  const objections = await getObjectionsByIds(scenario.objectionIds);

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

    const evaluationPrompt = await buildEvaluationPrompt(scenario, objections, messages);

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
