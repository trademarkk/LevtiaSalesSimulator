"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  ChatMessage,
  ChatPhase,
  ScenarioContext,
  ScenarioDifficulty,
  TrainerMode,
  TrainingState,
  TrainingReplyQuality,
} from "@/lib/types";

type ChatTrainerStepLiveProps = {
  userName: string;
  adminDisplayName: string;
};

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((event: { error: string; message?: string }) => void);
  onresult: null | ((event: { resultIndex: number; results: ArrayLike<(ArrayLike<{ transcript: string }> & { isFinal?: boolean })> }) => void);
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const difficultyOptions: Array<{ value: ScenarioDifficulty; label: string; hint: string }> = [
  { value: "easy", label: "Легкая", hint: "Более прямые и простые сомнения клиента." },
  { value: "medium", label: "Средняя", hint: "Комбинация стандартных и более тонких возражений." },
  { value: "hard", label: "Сложная", hint: "Более стойкие сомнения и высокий риск потери клиента." },
];

const stepOptions = [3, 15, 20, 25, 30, 35];

function getModeLabel(mode: TrainerMode | null) {
  if (mode === "openrouter") return "Живой OpenRouter";
  if (mode === "deepseek") return "Живой DeepSeek";
  if (mode === "openai") return "Живой OpenAI";
  if (mode === "demo") return "Демо-режим";
  return "Ожидание";
}

function getModeHint(mode: TrainerMode | null) {
  if (mode === "openrouter") return "Сейчас диалог идет через OpenRouter и возвращается потоково в реальном времени.";
  if (mode === "deepseek") return "Сейчас диалог идет через DeepSeek и возвращается потоково в реальном времени.";
  if (mode === "openai") return "Сейчас диалог идет через OpenAI и возвращается потоково в реальном времени.";
  if (mode === "demo") return "Сейчас активен демо-режим. Подключите API-ключ, если нужен живой ИИ.";
  return "После старта тренировки здесь появится активный режим модели.";
}

function sanitizeClientReply(text: string) {
  return text
    .replace(/^[\s\S]*?<\/think>\s*/i, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^\s*(клиентка|клиент|customer)\s*:\s*/i, "")
    .replace(/\n+\s*(администратор|administrator)\s*:.*$/is, "")
    .replace(/\n+\s*(клиентка|клиент|customer)\s*:\s*/gi, "\n")
    .trim();
}

function countAdminReplies(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === "user").length;
}

function getSpeechRecognitionErrorMessage(error?: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Браузер не получил доступ к микрофону. Проверь разрешение на микрофон для Safari и открой сайт по HTTPS.";
    case "audio-capture":
      return "Не удалось получить звук с микрофона. Проверь, что микрофон не занят другим приложением.";
    case "network":
      return "Ошибка распознавания речи. На iPhone это часто связано с Safari. Попробуй еще раз, проверь интернет или перезагрузи страницу.";
    case "no-speech":
      return "Речь не распознана. Попробуй говорить чуть дольше и громче после старта записи.";
    case "aborted":
      return "Запись была остановлена до завершения распознавания.";
    case "language-not-supported":
      return "Браузер не поддерживает распознавание для выбранного языка.";
    default:
      return "Не удалось распознать голос. Попробуйте еще раз.";
  }
}

function clampLevel(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function detectReplyQuality(message: string): TrainingReplyQuality {
  const normalized = message.toLowerCase();
  let score = 0;

  if (normalized.length > 180) score += 1;
  if (/(понимаю|слышу|согласна|согласен|важно|давайте посмотрим|подберем|подберём|удобно|комфортно)/.test(normalized)) score += 1;
  if (/(абонемент|расписан|время|оплат|рассроч|формат|результат|цель|задач)/.test(normalized)) score += 1;
  if (/(давайте|предлагаю|можем|запишу|оформим|отправлю)/.test(normalized)) score += 1;
  if (/(дорого|нет времени|не смогу|неудобно|муж|травм|боюсь)/.test(normalized)) score += 1;

  if (score >= 4) return "strong";
  if (score >= 2) return "medium";
  return "weak";
}

function buildInitialTrainingState(): TrainingState {
  return {
    turnNumber: 1,
    currentMainConcern: "первичное сомнение после пробного занятия",
    resolvedConcerns: [],
    unresolvedConcerns: [],
    trustLevel: 4,
    interestLevel: 6,
    resistanceLevel: 6,
    clientMood: "осторожная, но заинтересованная",
    lastAdminReplyQuality: "medium",
    lastAdminAskedQuestion: false,
    lastAdminQuestionTopic: "",
    shouldAnswerDirectly: false,
    pendingDirectAnswerTopic: "",
    directAnswerUrgency: 0,
    preferredAnswerStyle: "direct_with_doubt",
    factsLearned: [],
    rapportNotes: ["контакт только начинается"],
  };
}

function updateTrainingState(previous: TrainingState | null, adminMessage: string, scenario: ScenarioContext, nextTurnNumber: number): TrainingState {
  const prev = previous ?? buildInitialTrainingState();
  const quality = detectReplyQuality(adminMessage);
  const normalized = adminMessage.toLowerCase();
  const asksQuestion = adminMessage.includes("?") || /^(а|и|то есть|скажите|подскажите|когда|почему|какой|какая|какие|где|зачем|сколько|можно ли|вам удобно|тебе удобно)/i.test(adminMessage.trim());
  const resolvedConcerns = [...prev.resolvedConcerns];
  const unresolvedConcerns = [...prev.unresolvedConcerns];
  const factsLearned = [...prev.factsLearned];
  const rapportNotes = [...prev.rapportNotes];

  const extractedFacts = [
    /(работ|график|смен)/.test(normalized) ? "обсуждалась занятость и график" : null,
    /(ребен|дет)/.test(normalized) ? "поднималась тема детей и бытовой нагрузки" : null,
    /(муж|партнер|карта|оформ)/.test(normalized) ? "обсуждалось влияние партнёра или оплаты" : null,
    /(спин|колен|травм|врач|здоров)/.test(normalized) ? "обсуждались ограничения по здоровью" : null,
    /(дорог|цен|оплат|рассроч)/.test(normalized) ? "обсуждалась цена и способ оплаты" : null,
    /(распис|утр|вечер|время)/.test(normalized) ? "обсуждалось удобство расписания" : null,
  ].filter(Boolean) as string[];

  for (const fact of extractedFacts) {
    if (!factsLearned.includes(fact)) factsLearned.push(fact);
  }

  let trustLevel = prev.trustLevel;
  let interestLevel = prev.interestLevel;
  let resistanceLevel = prev.resistanceLevel;
  let clientMood = prev.clientMood;
  let currentMainConcern = prev.currentMainConcern;
  let lastAdminQuestionTopic = "";

  if (/(дорог|цен|оплат|рассроч)/.test(normalized)) {
    lastAdminQuestionTopic = "цена и оплата";
  } else if (/(распис|утр|вечер|время|график)/.test(normalized)) {
    lastAdminQuestionTopic = "время и расписание";
  } else if (/(травм|врач|здоров|спин|колен)/.test(normalized)) {
    lastAdminQuestionTopic = "здоровье и ограничения";
  } else if (/(муж|партнер|карта|оформ)/.test(normalized)) {
    lastAdminQuestionTopic = "согласование и оформление";
  } else if (/(далек|ехать|локац)/.test(normalized)) {
    lastAdminQuestionTopic = "локация и дорога";
  } else if (/(цель|зачем|результат|хотите)/.test(normalized)) {
    lastAdminQuestionTopic = "цель и результат";
  }

  if (quality === "strong") {
    trustLevel += 2;
    interestLevel += 1;
    resistanceLevel -= 2;
    clientMood = "осторожная, но стала заметно теплее";
    rapportNotes.push("администратор ответил уверенно и по делу");
  } else if (quality === "medium") {
    trustLevel += 1;
    resistanceLevel -= 1;
    clientMood = "слушает, но всё ещё проверяет";
    rapportNotes.push("администратор держит контакт, но не везде добивает аргумент");
  } else {
    trustLevel -= 1;
    interestLevel -= 1;
    resistanceLevel += 1;
    clientMood = "напряженная и не до конца убеждённая";
    rapportNotes.push("ответ ощущался общим или слабым");
  }

  if (/(дорог|цен|оплат|рассроч)/.test(normalized)) {
    currentMainConcern = "цена и способ оплаты";
  } else if (/(распис|утр|вечер|время|график)/.test(normalized)) {
    currentMainConcern = "время и регулярность посещения";
  } else if (/(травм|врач|здоров|спин|колен)/.test(normalized)) {
    currentMainConcern = "безопасность и здоровье";
  } else if (/(муж|партнер|карта|оформ)/.test(normalized)) {
    currentMainConcern = "согласование оплаты и решения с партнером";
  } else if (/(далек|ехать|локац)/.test(normalized)) {
    currentMainConcern = "локация и дорога";
  } else {
    currentMainConcern = prev.currentMainConcern || scenario.purchaseSignal;
  }

  if (quality === "strong" && !resolvedConcerns.includes(currentMainConcern)) {
    resolvedConcerns.push(currentMainConcern);
  }

  if (quality !== "strong" && !unresolvedConcerns.includes(currentMainConcern)) {
    unresolvedConcerns.push(currentMainConcern);
  }

  const effectiveQuestionTopic = lastAdminQuestionTopic || currentMainConcern;
  const directAnswerUrgency = asksQuestion
    ? Math.min(10, (prev.directAnswerUrgency || 0) + 3)
    : Math.max(0, (prev.directAnswerUrgency || 0) - 2);

  const preferredAnswerStyle = asksQuestion
    ? quality === "strong"
      ? "direct_with_relief"
      : /(почему|зачем)/.test(normalized)
        ? "direct_with_emotion"
        : /(можно ли|получается|удобно|подойдет|подойдёт)/.test(normalized)
          ? "direct_with_question"
          : "direct_with_doubt"
    : prev.preferredAnswerStyle;

  return {
    turnNumber: nextTurnNumber,
    currentMainConcern,
    resolvedConcerns: [...new Set(resolvedConcerns)].slice(-6),
    unresolvedConcerns: [...new Set(unresolvedConcerns.filter((item) => !resolvedConcerns.includes(item)))].slice(-6),
    trustLevel: clampLevel(trustLevel),
    interestLevel: clampLevel(interestLevel),
    resistanceLevel: clampLevel(resistanceLevel),
    clientMood,
    lastAdminReplyQuality: quality,
    lastAdminAskedQuestion: asksQuestion,
    lastAdminQuestionTopic: effectiveQuestionTopic,
    shouldAnswerDirectly: asksQuestion,
    pendingDirectAnswerTopic: asksQuestion ? effectiveQuestionTopic : "",
    directAnswerUrgency,
    preferredAnswerStyle,
    factsLearned: [...new Set(factsLearned)].slice(-8),
    rapportNotes: [...new Set(rapportNotes)].slice(-6),
  };
}

export function ChatTrainerStepLive({ userName, adminDisplayName }: ChatTrainerStepLiveProps) {
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>("medium");
  const [stepCount, setStepCount] = useState(20);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenario, setScenario] = useState<ScenarioContext | null>(null);
  const [evaluation, setEvaluation] = useState("");
  const [input, setInput] = useState("");
  const [inputSource, setInputSource] = useState<"text" | "voice">("text");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<TrainerMode | null>(null);
  const [completed, setCompleted] = useState(false);
  const [trainingStartedAt, setTrainingStartedAt] = useState("");
  const [historySaved, setHistorySaved] = useState(false);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastBubbleRef = useRef<HTMLDivElement | null>(null);

  const adminReplyCount = useMemo(() => countAdminReplies(messages), [messages]);
  const chatReady = scenario !== null && !completed;
  const currentStep = scenario ? Math.min(adminReplyCount + 1, scenario.stepCount) : 0;
  const scenarioLocked = Boolean(scenario && !completed);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(Recognition));
  }, []);

  useEffect(() => {
    lastBubbleRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, evaluation]);

  function stopRecognition() {
    recognitionRef.current?.stop?.();
    setIsRecording(false);
  }

  function startRecognition() {
    if (typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Этот браузер не поддерживает голосовой ввод через Web Speech API.");
      return;
    }

    if (!window.isSecureContext) {
      setError("Голосовой ввод работает только в защищенном контексте. Открой приложение по HTTPS.");
      return;
    }

    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setError("");

    const recognition = new Recognition();
    let finalTranscript = "";
    let stopRequested = false;

    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
      if (stopRequested) {
        const normalizedTranscript = finalTranscript.trim();
        if (normalizedTranscript) {
          setInput(normalizedTranscript);
          setInputSource("voice");
          setError("");
        } else {
          setError("Речь не распознана. Попробуй говорить чуть дольше после нажатия на запись.");
        }
        setIsRecording(false);
        recognitionRef.current = null;
        return;
      }

      try {
        recognition.start();
      } catch {
        setIsRecording(false);
        recognitionRef.current = null;
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" && stopRequested) {
        return;
      }
      setIsRecording(false);
      recognitionRef.current = null;
      setError(getSpeechRecognitionErrorMessage(event.error));
    };
    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalTranscript += `${chunk} `;
        } else {
          interimTranscript += chunk;
        }
      }

      const combinedTranscript = `${finalTranscript} ${interimTranscript}`.trim();
      if (combinedTranscript) {
        setInput(combinedTranscript);
        setInputSource("voice");
      }
    };

    recognitionRef.current = {
      stop: () => {
        stopRequested = true;
        recognition.stop();
      },
      abort: () => {
        stopRequested = true;
        recognition.abort?.();
      },
    };

    try {
      recognition.start();
    } catch {
      setIsRecording(false);
      recognitionRef.current = null;
      setError("Не удалось запустить голосовой ввод. На iPhone попробуй обновить страницу и разрешить доступ к микрофону в Safari.");
    }
  }

  async function streamText(input: {
    messages: ChatMessage[];
    scenario: ScenarioContext;
    trainingState?: TrainingState | null;
    phase: ChatPhase;
    turnNumber?: number;
    onUpdate: (text: string) => void;
  }) {
    if (input.phase === "conversation") {
      try {
        const previewResponse = await fetch("/api/prompt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: input.messages, scenario: input.scenario, trainingState: input.trainingState, phase: input.phase, turnNumber: input.turnNumber }),
        });
        const previewPayload = (await previewResponse.json()) as { prompt?: string; error?: string };
        if (previewResponse.ok && previewPayload.prompt) {
          console.log("[client] prompt sent to AI:\n" + previewPayload.prompt);
        } else {
          console.warn("[client] prompt preview unavailable", previewPayload.error || "unknown error");
        }
      } catch (previewError) {
        console.warn("[client] prompt preview request failed", previewError);
      }
    }

    const response = await fetch("/api/chat-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: input.messages, scenario: input.scenario, trainingState: input.trainingState, phase: input.phase, turnNumber: input.turnNumber }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "Не удалось получить ответ ИИ.");
    }
    if (!response.body) throw new Error("ИИ не вернул поток ответа.");

    const nextMode = (response.headers.get("x-trainer-mode") as TrainerMode | null) || "demo";
    setMode(nextMode);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      input.onUpdate(input.phase === "conversation" ? sanitizeClientReply(accumulated) : accumulated);
    }
    accumulated += decoder.decode();
    const finalText = input.phase === "conversation" ? sanitizeClientReply(accumulated) : accumulated.trim();
    input.onUpdate(finalText);
    return finalText;
  }

  async function requestClientTurn(baseMessages: ChatMessage[], activeScenario: ScenarioContext, activeTrainingState: TrainingState | null, turnNumber: number) {
    setMessages([...baseMessages, { role: "assistant", content: "" }]);
    try {
      const clientReply = await streamText({ messages: baseMessages, scenario: activeScenario, trainingState: activeTrainingState, phase: "conversation", turnNumber, onUpdate: (text) => setMessages([...baseMessages, { role: "assistant", content: text }]) });
      setMessages([...baseMessages, { role: "assistant", content: clientReply }]);
    } catch (replyError) {
      setMessages(baseMessages);
      throw replyError;
    }
  }

  async function requestEvaluation(baseMessages: ChatMessage[], activeScenario: ScenarioContext, activeTrainingState: TrainingState | null) {
    setEvaluation("");
    const result = await streamText({ messages: baseMessages, scenario: activeScenario, trainingState: activeTrainingState, phase: "evaluation", onUpdate: (text) => setEvaluation(text) });
    setEvaluation(result);
    return result;
  }

  async function persistTrainingHistory(input: { activeScenario: ScenarioContext; transcript: ChatMessage[]; evaluationText: string; activeMode: TrainerMode; startedAt: string; }) {
    const response = await fetch("/api/training-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminDisplayName: adminDisplayName.trim(), scenario: input.activeScenario, trainerMode: input.activeMode, evaluationText: input.evaluationText, messages: input.transcript, startedAt: input.startedAt }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "Не удалось сохранить тренировку в историю.");
    }
  }

  async function startScenario() {
    setLoading(true); setError(""); setInput(""); setEvaluation(""); setCompleted(false); setHistorySaved(false); setInputSource("text"); setTrainingState(null);
    try {
      const scenarioResponse = await fetch("/api/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ difficulty, stepCount }) });
      const scenarioPayload = (await scenarioResponse.json()) as { scenario?: ScenarioContext; error?: string };
      if (!scenarioResponse.ok || !scenarioPayload.scenario) throw new Error(scenarioPayload.error || "Не удалось собрать сценарий.");
      const nextStartedAt = new Date().toISOString();
      const initialTrainingState = buildInitialTrainingState();
      setTrainingState(initialTrainingState);
      setScenario(scenarioPayload.scenario); setMessages([]); setTrainingStartedAt(nextStartedAt); await requestClientTurn([], scenarioPayload.scenario, initialTrainingState, 1);
    } catch (scenarioError) {
      setError(scenarioError instanceof Error ? scenarioError.message : "Не удалось запустить тренировку.");
      setScenario(null); setMessages([]); setEvaluation(""); setCompleted(false); setTrainingStartedAt(""); setTrainingState(null);
    } finally { setLoading(false); }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!chatReady || !input.trim() || loading || !scenario) return;
    const previousMessages = messages;
    const adminMessage: ChatMessage = { role: "user", content: input.trim(), inputSource };
    const nextMessages = [...messages, adminMessage];
    const nextAdminReplyCount = countAdminReplies(nextMessages);
    setMessages(nextMessages); setInput(""); setInputSource("text"); setLoading(true); setError("");
    try {
      const nextTrainingState = updateTrainingState(trainingState, adminMessage.content, scenario, nextAdminReplyCount + 1);
      setTrainingState(nextTrainingState);

      if (nextAdminReplyCount >= scenario.stepCount) {
        const evaluationText = await requestEvaluation(nextMessages, scenario, nextTrainingState);
        setCompleted(true);
        try {
          await persistTrainingHistory({ activeScenario: scenario, transcript: nextMessages, evaluationText, activeMode: mode || "demo", startedAt: trainingStartedAt || new Date().toISOString() });
          setHistorySaved(true);
        } catch (historyError) { setError(historyError instanceof Error ? historyError.message : "Разбор готов, но историю тренировки сохранить не удалось."); }
        setTrainingState(null);
      } else {
        await requestClientTurn(nextMessages, scenario, nextTrainingState, nextAdminReplyCount + 1);
      }
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "ИИ временно недоступен.");
      setMessages(previousMessages); setInput(adminMessage.content); setInputSource(adminMessage.inputSource || "text"); setEvaluation(""); setCompleted(false);
    } finally { setLoading(false); }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSubmit(); }
  }

  return (
    <section className="trainer-layout">
      <aside className="trainer-panel trainer-panel--accent">
        <span className="pill pill--soft">Тренажер администратора</span>
        <h2>Диалог после пробного занятия</h2>
        <p>{userName}, здесь можно запускать тренировку по сценарию с разной сложностью и длиной диалога. ИИ отвечает только от лица клиентки, а после последнего ответа администратора отдельно формирует разбор результата.</p>
        <div className="stats-grid">
          <article className="stat-card"><span>Режим</span><strong>{getModeLabel(mode)}</strong></article>
          <article className="stat-card"><span>Шаг</span><strong>{scenario ? `${currentStep} / ${scenario.stepCount}` : `0 / ${stepCount}`}</strong></article>
          <article className="stat-card"><span>Статус</span><strong>{completed ? "Разбор готов" : scenario ? "Диалог идет" : "Не начат"}</strong></article>
        </div>
        <div className="note-card trainer-config">
          <h3>Параметры тренировки</h3>
          <div className="trainer-config__grid">
            <label><span>Администратор</span><input type="text" value={adminDisplayName} readOnly disabled /></label>
            <label><span>Сложность</span><select value={difficulty} onChange={(e) => setDifficulty(e.target.value as ScenarioDifficulty)} disabled={loading || scenarioLocked}>{difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><span>Количество шагов</span><select value={stepCount} onChange={(e) => setStepCount(Number(e.target.value))} disabled={loading || scenarioLocked}>{stepOptions.map((option) => <option key={option} value={option}>{option === 3 ? '3 (тест)' : option}</option>)}</select></label>
          </div>
          <p>{difficultyOptions.find((option) => option.value === difficulty)?.hint}</p>
          {stepCount === 3 ? <p>Тестовый режим: короткий сценарий на 3 шага для быстрой проверки UX и логики.</p> : null}
          <p>История будет сохранена за конкретным администратором из аккаунта, под которым выполнен вход.</p>
          <button type="button" className="primary-button" onClick={startScenario} disabled={loading}>{loading ? "Готовим тренировку..." : "Начать тренировку"}</button>
        </div>
        <div className="note-card"><h3>Как это работает</h3><ul><li>На старте в ИИ уходит ваш промпт руководителя, персона клиентки и нужные возражения.</li><li>Первая реплика всегда приходит только от лица клиента без готового сценария целиком.</li><li>После каждого ответа администратора ИИ продолжает диалог следующим возражением.</li><li>После последнего шага появляется отдельный итоговый разбор по промпту.</li></ul></div>
        <div className="note-card"><h3>Активный режим</h3><p>{getModeHint(mode)}</p></div>
      </aside>
      <div className="trainer-panel trainer-panel--chat">
        {scenario ? (
          <section className="manager-card trainer-client-profile">
            <div className="manager-card__header trainer-client-profile__header">
              <div>
                <span className="pill pill--soft">Профиль клиентки</span>
                <h2 className="trainer-client-profile__title">Контекст текущей тренировки</h2>
              </div>
            </div>
            <div className="trainer-config__grid trainer-client-profile__grid">
              <label className="trainer-client-profile__field">
                <span className="trainer-client-profile__label">Имя / возраст / общий профиль</span>
                <textarea className="trainer-client-profile__textarea" value={`${scenario.persona}\nМанера речи: ${scenario.speechStyle}\nТемперамент: ${scenario.temperament}`} readOnly rows={4} />
              </label>
              <label className="trainer-client-profile__field">
                <span className="trainer-client-profile__label">Пробное занятие / впечатление</span>
                <textarea className="trainer-client-profile__textarea" value={`Направление: ${scenario.lessonDirection}\n${scenario.lessonImpression}`} readOnly rows={3} />
              </label>
            </div>
          </section>
        ) : null}
        <div className="chat-window">
          {messages.length === 0 ? <div className="chat-placeholder"><h3>Тренировка еще не запущена</h3><p>Выберите сложность, количество шагов и нажмите «Начать тренировку». После этого в чат придет только первая реплика клиентки.</p></div> : messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`message-bubble ${message.role === "assistant" ? "message-bubble--assistant" : "message-bubble--user"}`} ref={index === messages.length - 1 ? lastBubbleRef : null}>
              <span>{message.role === "assistant" ? "Клиентка" : `Администратор${message.inputSource ? ` · ${message.inputSource === 'voice' ? 'голос' : 'вручную'}` : ''}`}</span>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
        {evaluation ? <section className="trainer-result" ref={lastBubbleRef}><span className="pill">Разбор тренировки</span><pre>{evaluation}</pre></section> : null}
        {historySaved ? <p className="form-success">Тренировка сохранена в истории руководителя.</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea value={input} onChange={(e) => { setInput(e.target.value); setInputSource("text"); }} onKeyDown={handleKeyDown} placeholder="Напишите ответ администратора клиентке..." disabled={!chatReady || loading} rows={4} />
          <div className="voice-toolbar">
            <div className="voice-toolbar__status">
              <span className={`pill ${isRecording ? "pill--active" : "pill--soft"}`}>
                {isRecording ? "Идет запись" : inputSource === "voice" && input.trim() ? "Текст получен голосом" : "Ручной ввод"}
              </span>
              <span className="chat-form__hint">
                {isRecording
                  ? "Говорите в микрофон. Когда закончите — нажмите остановить."
                  : inputSource === "voice" && input.trim()
                    ? "Распознанный текст можно отредактировать перед отправкой."
                    : completed
                      ? "Диалог завершен. Ниже уже доступен итоговый разбор."
                      : scenario
                        ? `Сейчас идет шаг ${currentStep} из ${scenario.stepCount}. Enter — отправить, Shift+Enter — новая строка.`
                        : "Сначала запустите тренировку, чтобы получить первое сообщение клиентки."}
              </span>
            </div>
            <div className="objection-card__actions">
              {speechSupported ? <button type="button" className={`secondary-button ${isRecording ? "voice-button--recording" : ""}`} onClick={() => (isRecording ? stopRecognition() : startRecognition())} disabled={!chatReady || loading}>{isRecording ? '⏹ Остановить запись' : '🎤 Записать голосом'}</button> : <span className="chat-form__hint">Голосовой ввод не поддерживается этим браузером.</span>}
              <button type="submit" className="primary-button" disabled={!chatReady || loading || !input.trim()}>{loading ? (adminReplyCount + 1 >= (scenario?.stepCount || stepCount) ? "Формируем разбор..." : "Отправляем...") : completed ? "Тренировка завершена" : "Ответить клиентке"}</button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
