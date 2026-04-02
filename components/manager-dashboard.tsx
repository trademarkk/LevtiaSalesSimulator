"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import type { ObjectionRecord } from "@/lib/types";

type ManagerDashboardProps = {
  initialObjections: ObjectionRecord[];
  initialPrompt: string;
  openAiEnabled: boolean;
};

type ObjectionFormState = {
  title: string;
  objectionText: string;
  coachHint: string;
  stage: string;
  difficulty: "easy" | "medium" | "hard";
  isActive: boolean;
  isRequired: boolean;
};

const defaultFormState: ObjectionFormState = {
  title: "",
  objectionText: "",
  coachHint: "",
  stage: "price",
  difficulty: "medium",
  isActive: true,
  isRequired: false,
};

const stageLabels: Record<string, string> = {
  price: "Цена",
  schedule: "Расписание",
  hesitation: "Сомнения",
  confidence: "Уверенность",
  location: "Локация",
  authority: "Согласование с близкими",
  decision: "Решение",
  comparison: "Сравнение",
  health: "Здоровье",
  follow_up: "Повторный контакт",
  competition: "Конкуренты",
  service: "Сервис",
  timing: "Сроки",
  relevance: "Актуальность",
  commitment: "Риск пропусков",
  readiness: "Готовность к старту",
  environment: "Атмосфера",
  trust: "Доверие",
  privacy: "Приватность",
  general: "Общее",
};

function normalizeFormState(objection: ObjectionRecord): ObjectionFormState {
  return {
    title: objection.title,
    objectionText: objection.objectionText,
    coachHint: objection.coachHint,
    stage: objection.stage,
    difficulty: objection.difficulty,
    isActive: Boolean(objection.isActive),
    isRequired: Boolean(objection.isRequired),
  };
}

export function ManagerDashboard({
  initialObjections,
  initialPrompt,
  openAiEnabled,
}: ManagerDashboardProps) {
  const [objections, setObjections] = useState(initialObjections);
  const [trainerPrompt, setTrainerPrompt] = useState(initialPrompt);
  const [formState, setFormState] = useState<ObjectionFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingObjection, setSavingObjection] = useState(false);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const formCardRef = useRef<HTMLFormElement | null>(null);

  const stages = useMemo(() => {
    return [...new Set(objections.map((item) => item.stage).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ru"),
    );
  }, [objections]);

  const filteredObjections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return objections.filter((item) => {
      if (stageFilter !== "all" && item.stage !== stageFilter) return false;
      if (difficultyFilter !== "all" && item.difficulty !== difficultyFilter) return false;
      if (activityFilter === "active" && !item.isActive) return false;
      if (activityFilter === "inactive" && item.isActive) return false;
      if (!normalizedQuery) return true;

      const haystack = [item.title, item.objectionText, item.coachHint, item.stage].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activityFilter, difficultyFilter, objections, query, stageFilter]);

  function resetForm() {
    setFormState(defaultFormState);
    setEditingId(null);
  }

  function openEditMode(objection: ObjectionRecord) {
    setFormState(normalizeFormState(objection));
    setEditingId(objection.id);
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handlePromptSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPrompt(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/manager/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerPrompt }),
      });

      const payload = (await response.json()) as { prompt?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить промпт.");
      }

      setTrainerPrompt(payload.prompt || trainerPrompt);
      setSuccess("Базовый промпт обновлен.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить промпт.");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleObjectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingObjection(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(editingId ? `/api/manager/objections/${editingId}` : "/api/manager/objections", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      const payload = (await response.json()) as { objections?: ObjectionRecord[]; error?: string };
      if (!response.ok || !payload.objections) {
        throw new Error(payload.error || "Не удалось сохранить шаблон.");
      }

      setObjections(payload.objections);
      resetForm();
      setSuccess(editingId ? "Шаблон обновлен." : "Новый шаблон возражения добавлен.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить шаблон.");
    } finally {
      setSavingObjection(false);
    }
  }

  async function toggleObjection(id: number, isActive: boolean) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/manager/objections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      const payload = (await response.json()) as { objections?: ObjectionRecord[]; error?: string };
      if (!response.ok || !payload.objections) {
        throw new Error(payload.error || "Не удалось обновить статус.");
      }

      setObjections(payload.objections);
      setSuccess("Статус возражения обновлен.");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Не удалось обновить запись.");
    }
  }

  async function toggleRequired(id: number, isRequired: boolean) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/manager/objections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRequired: !isRequired }),
      });

      const payload = (await response.json()) as { objections?: ObjectionRecord[]; error?: string };
      if (!response.ok || !payload.objections) {
        throw new Error(payload.error || "Не удалось обновить обязательность.");
      }

      setObjections(payload.objections);
      setSuccess(!isRequired ? "Возражение помечено как обязательное." : "Возражение больше не обязательное.");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Не удалось обновить обязательность.");
    }
  }

  async function removeObjection(id: number) {
    setError("");
    setSuccess("");

    if (!window.confirm("Удалить этот шаблон возражения?")) {
      return;
    }

    try {
      const response = await fetch(`/api/manager/objections/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { objections?: ObjectionRecord[]; error?: string };
      if (!response.ok || !payload.objections) {
        throw new Error(payload.error || "Не удалось удалить шаблон.");
      }

      setObjections(payload.objections);
      if (editingId === id) resetForm();
      setSuccess("Шаблон удален.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить шаблон.");
    }
  }

  return (
    <section className="manager-layout">
      <div className="stats-grid">
        <article className="stat-card"><span>Всего шаблонов</span><strong>{objections.length}</strong></article>
        <article className="stat-card"><span>Активных в сценариях</span><strong>{objections.filter((item) => item.isActive).length}</strong></article>
        <article className="stat-card"><span>Статус ИИ</span><strong>{openAiEnabled ? "OpenAI подключен" : "Демо-режим"}</strong></article>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <div className="manager-columns">
        <form className="manager-card" onSubmit={handlePromptSave}>
          <div className="manager-card__header"><div><span className="pill pill--soft">Промпт тренажера</span><h2>Базовая инструкция для ИИ</h2></div></div>
          <label>
            <span>Системный промпт</span>
            <textarea rows={10} value={trainerPrompt} onChange={(event) => setTrainerPrompt(event.target.value)} placeholder="Опишите правила, по которым ИИ должен вести себя как клиент." />
          </label>
          <button type="submit" className="primary-button" disabled={savingPrompt}>{savingPrompt ? "Сохраняем..." : "Сохранить промпт"}</button>
        </form>

        <form className="manager-card" onSubmit={handleObjectionSubmit} ref={formCardRef}>
          <div className="manager-card__header"><div><span className="pill pill--soft">Библиотека возражений</span><h2>{editingId ? "Редактировать шаблон" : "Добавить новый шаблон"}</h2></div></div>

          <label><span>Название</span><input type="text" value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} placeholder="Например: Дорого" required /></label>
          <label><span>Текст возражения</span><textarea rows={5} value={formState.objectionText} onChange={(event) => setFormState((current) => ({ ...current, objectionText: event.target.value }))} placeholder="Как клиентка формулирует сомнение в диалоге" required /></label>
          <label><span>Подсказка для руководителя</span><textarea rows={3} value={formState.coachHint} onChange={(event) => setFormState((current) => ({ ...current, coachHint: event.target.value }))} placeholder="Что должен отрабатывать администратор" /></label>

          <div className="inline-fields">
            <label>
              <span>Этап</span>
              <select value={formState.stage} onChange={(event) => setFormState((current) => ({ ...current, stage: event.target.value }))}>
                {Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Сложность</span>
              <select value={formState.difficulty} onChange={(event) => setFormState((current) => ({ ...current, difficulty: event.target.value as ObjectionFormState["difficulty"] }))}>
                <option value="easy">Легкая</option>
                <option value="medium">Средняя</option>
                <option value="hard">Сильная</option>
              </select>
            </label>
          </div>

          <label className="checkbox-field"><input type="checkbox" checked={formState.isActive} onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))} /><span>Сразу использовать это возражение в новых сценариях</span></label>
          <label className="checkbox-field"><input type="checkbox" checked={formState.isRequired} onChange={(event) => setFormState((current) => ({ ...current, isRequired: event.target.checked }))} /><span>Обязательно использовать в тренировке</span></label>

          <div className="form-toolbar">
            <button type="submit" className="primary-button" disabled={savingObjection}>{savingObjection ? "Сохраняем..." : editingId ? "Сохранить шаблон" : "Добавить шаблон"}</button>
            {editingId ? <button type="button" className="secondary-button" onClick={resetForm}>Отменить редактирование</button> : null}
          </div>
        </form>
      </div>

      <div className="manager-card">
        <div className="manager-card__header"><div><span className="pill pill--soft">Текущая база</span><h2>Шаблоны возражений</h2></div></div>

        <div className="manager-filters">
          <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, тексту, подсказке или этапу" />
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="all">Все этапы</option>
            {stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage] || stage}</option>)}
          </select>
          <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
            <option value="all">Любая сложность</option><option value="easy">Легкая</option><option value="medium">Средняя</option><option value="hard">Сильная</option>
          </select>
          <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
            <option value="all">Все статусы</option><option value="active">Только активные</option><option value="inactive">Только отключенные</option>
          </select>
        </div>

        <div className="objection-list">
          {filteredObjections.map((objection) => (
            <article key={objection.id} className="objection-card">
              <div className="objection-card__meta">
                <span className="pill">{objection.difficulty}</span>
                <span className={`pill ${objection.isActive ? "pill--active" : "pill--inactive"}`}>{objection.isActive ? "Активно" : "Отключено"}</span>
                {objection.isRequired ? <span className="pill pill--soft">Обязательное</span> : null}
              </div>
              <h3>{objection.title}</h3>
              <p>{objection.objectionText}</p>
              {objection.coachHint ? <small>Подсказка: {objection.coachHint}</small> : null}
              <div className="objection-card__footer objection-card__footer--stack">
                <span>Этап: {stageLabels[objection.stage] || objection.stage}</span>
                <div className="objection-card__actions">
                  <button type="button" className="secondary-button" onClick={() => openEditMode(objection)}>Редактировать</button>
                  <button type="button" className="secondary-button" onClick={() => toggleRequired(objection.id, Boolean(objection.isRequired))}>{objection.isRequired ? "Сделать необязательным" : "Сделать обязательным"}</button>
                  <button type="button" className="secondary-button" onClick={() => toggleObjection(objection.id, Boolean(objection.isActive))}>{objection.isActive ? "Отключить" : "Включить"}</button>
                  <button type="button" className="secondary-button danger-button" onClick={() => removeObjection(objection.id)}>Удалить</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
