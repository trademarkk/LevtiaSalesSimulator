"use client";

import { FormEvent, useMemo, useState } from "react";

import type { ChatMessage, ScenarioContext } from "@/lib/types";

type TrainerMode = "openai" | "demo" | null;

type ChatTrainerProps = {
  userName: string;
};

export function ChatTrainer({ userName }: ChatTrainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenario, setScenario] = useState<ScenarioContext | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<TrainerMode>(null);

  const chatReady = useMemo(() => scenario !== null, [scenario]);

  async function requestTrainerReply(nextMessages: ChatMessage[], nextScenario: ScenarioContext) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: nextMessages,
        scenario: nextScenario,
      }),
    });

    const payload = (await response.json()) as { reply?: string; mode?: TrainerMode; error?: string };

    if (!response.ok || !payload.reply) {
      throw new Error(payload.error || "Не удалось получить ответ ИИ.");
    }

    setMode(payload.mode || "demo");
    return payload.reply;
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
      const opener = await requestTrainerReply([], scenarioPayload.scenario);
      setMessages([{ role: "assistant", content: opener }]);
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

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const reply = await requestTrainerReply(nextMessages, activeScenario);
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "ИИ временно недоступен.");
      setMessages(messages);
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
          {userName}, здесь ИИ играет роль клиентки LEVITA. Возражения берутся из библиотеки,
          которую пополняет руководитель.
        </p>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Режим</span>
            <strong>{mode === "openai" ? "Живой OpenAI" : mode === "demo" ? "Демо-режим" : "Ожидание"}</strong>
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
          <h3>Как работает тренировка</h3>
          <ul>
            <li>ИИ ведет себя как клиентка, вышедшая после пробного занятия.</li>
            <li>Он не показывает возражения заранее и раскрывает их постепенно.</li>
            <li>Если аргументация администратора сильная, клиентка смягчается и идет к покупке.</li>
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
            placeholder="Напишите ответ администраторa клиентке..."
            disabled={!chatReady || loading}
            rows={4}
          />

          <div className="chat-form__actions">
            <span className="chat-form__hint">
              {mode === "demo"
                ? "Сейчас активен демо-режим. Добавьте OPENAI_API_KEY для живого диалога."
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
