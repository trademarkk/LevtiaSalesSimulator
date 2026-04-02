"use client";

import { FormEvent, useMemo, useState } from "react";

import type { ChatMessage, ScenarioContext, TrainerMode } from "@/lib/types";

type ChatTrainerLiveProps = {
  userName: string;
};

export function ChatTrainerLive({ userName }: ChatTrainerLiveProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenario, setScenario] = useState<ScenarioContext | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<TrainerMode | null>(null);

  const chatReady = useMemo(() => scenario !== null, [scenario]);

  async function streamAssistantReply(nextMessages: ChatMessage[], nextScenario: ScenarioContext) {
    const response = await fetch("/api/chat-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: nextMessages,
        scenario: nextScenario,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "Не удалось получить ответ ИИ.");
    }

    if (!response.body) {
      throw new Error("ИИ не вернул поток ответа.");
    }

    const nextMode = (response.headers.get("x-trainer-mode") as TrainerMode | null) || "demo";
    setMode(nextMode);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    setMessages((current) => [...current, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      accumulated += decoder.decode(value, { stream: true });

      setMessages((current) => {
        const updated = [...current];

        if (updated.length === 0) {
          return [{ role: "assistant", content: accumulated }];
        }

        updated[updated.length - 1] = {
          role: "assistant",
          content: accumulated,
        };

        return updated;
      });
    }

    return accumulated;
  }

  async function startScenario() {
    setLoading(true);
    setError("");

    try {
      const scenarioResponse = await fetch("/api/scenario", { method: "POST" });
      const scenarioPayload = (await scenarioResponse.json()) as {
        scenario?: ScenarioContext;
        error?: string;
      };

      if (!scenarioResponse.ok || !scenarioPayload.scenario) {
        throw new Error(scenarioPayload.error || "Не удалось собрать сценарий.");
      }

      setScenario(scenarioPayload.scenario);
      setMessages([]);
      await streamAssistantReply([], scenarioPayload.scenario);
    } catch (scenarioError) {
      setError(
        scenarioError instanceof Error ? scenarioError.message : "Не удалось запустить тренировку.",
      );
      setScenario(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!chatReady || !input.trim() || loading) {
      return;
    }

    const activeScenario = scenario;

    if (!activeScenario) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
    };

    const previousMessages = messages;
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      await streamAssistantReply(nextMessages, activeScenario);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "ИИ временно недоступен.");
      setMessages(previousMessages);
      setInput(userMessage.content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="trainer-layout">
      <aside className="trainer-panel trainer-panel--accent">
        <span className="pill pill--soft">Тренажер администратора</span>
        <h2>Диалог после пробного занятия</h2>
        <p>
          {userName}, при старте тренировки в модель уходит ваш базовый промпт, сценарий клиентки
          и выбранные возражения из библиотеки руководителя.
        </p>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Режим</span>
            <strong>
              {mode === "openrouter"
                ? "Живой OpenRouter"
                : mode === "deepseek"
                ? "Живой DeepSeek"
                : mode === "openai"
                  ? "Живой OpenAI"
                  : mode === "demo"
                    ? "Демо-режим"
                    : "Ожидание"}
            </strong>
          </article>

          <article className="stat-card">
            <span>Сценарий</span>
            <strong>{chatReady ? "Активен" : "Не начат"}</strong>
          </article>
        </div>

        <button type="button" className="primary-button" onClick={startScenario} disabled={loading}>
          {loading ? "Готовим сценарий..." : chatReady ? "Начать новый сценарий" : "Запустить тренировку"}
        </button>

        <div className="note-card">
          <h3>Как это работает</h3>
          <ul>
            <li>На старте в ИИ уходит ваш промпт из кабинета руководителя.</li>
            <li>OpenRouter отвечает потоково и использует бесплатный роутер `openrouter/free`.</li>
            <li>Дальше диалог продолжается в реальном времени в одном окне чата.</li>
          </ul>
        </div>
      </aside>

      <div className="trainer-panel trainer-panel--chat">
        <div className="chat-window">
          {messages.length === 0 ? (
            <div className="chat-placeholder">
              <h3>Сценарий еще не запущен</h3>
              <p>
                Нажмите на кнопку слева, и ИИ начнет диалог как клиентка, сомневающаяся в покупке
                абонемента.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`message-bubble ${
                  message.role === "assistant" ? "message-bubble--assistant" : "message-bubble--user"
                }`}
              >
                <span>{message.role === "assistant" ? "Клиентка" : "Администратор"}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Напишите ответ администратора клиентке..."
            disabled={!chatReady || loading}
            rows={4}
          />

          <div className="chat-form__actions">
            <span className="chat-form__hint">
              {mode === "openrouter"
                ? "Сейчас активен OpenRouter Free Router, ответ идет потоково в реальном времени."
                : mode === "deepseek"
                ? "Сейчас активен DeepSeek и ответ идет потоково в реальном времени."
                : mode === "demo"
                  ? "Сейчас активен демо-режим. Добавьте OPENROUTER_API_KEY или другой ключ провайдера для живого диалога."
                  : "Пишите коротко, как в реальном чате с клиентом."}
            </span>

            <button type="submit" className="primary-button" disabled={!chatReady || loading || !input.trim()}>
              {loading ? "Отправляем..." : "Ответить клиентке"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
