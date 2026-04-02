"use client";

import { FormEvent, useState } from "react";

import type { AdminAccountSummary } from "@/lib/types";

type Props = {
  initialAdmins: AdminAccountSummary[];
};

export function ManagerAdminsPanel({ initialAdmins }: Props) {
  const [admins, setAdmins] = useState(Array.isArray(initialAdmins) ? initialAdmins : []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function applyAdmins(payload: any) {
    setAdmins(Array.isArray(payload?.admins) ? payload.admins : []);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/manager/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось создать администратора.");
      applyAdmins(payload);
      setSuccess("Администратор создан.");
      setName("");
      setEmail("");
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать администратора.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: number, status: "active" | "disabled") {
    setError("");
    setSuccess("");
    const nextStatus = status === "active" ? "disabled" : "active";
    const response = await fetch(`/api/manager/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Не удалось обновить статус.");
      return;
    }
    applyAdmins(payload);
    setSuccess("Статус администратора обновлен.");
  }

  async function resetPassword(id: number) {
    const nextPassword = window.prompt("Введите новый временный пароль (минимум 6 символов):");
    if (!nextPassword) return;
    setError("");
    setSuccess("");
    const response = await fetch(`/api/manager/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: nextPassword }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Не удалось сбросить пароль.");
      return;
    }
    applyAdmins(payload);
    setSuccess(`Пароль обновлен. Новый временный пароль: ${nextPassword}`);
  }

  async function deleteAdmin(id: number, adminName: string) {
    if (!window.confirm(`Удалить администратора ${adminName}?`)) return;
    setError("");
    setSuccess("");
    const response = await fetch(`/api/manager/admins/${id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Не удалось удалить администратора.");
      return;
    }
    applyAdmins(payload);
    setSuccess("Администратор удален.");
  }

  return (
    <section className="manager-layout">
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <div className="manager-columns">
        <form className="manager-card" onSubmit={handleCreate}>
          <div className="manager-card__header"><div><span className="pill pill--soft">Администраторы</span><h2>Создать администратора</h2></div></div>
          <label><span>Имя администратора</span><input value={name} onChange={(e)=>setName(e.target.value)} required /></label>
          <label><span>Email</span><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
          <label><span>Временный пароль</span><input type="text" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
          <button type="submit" className="primary-button" disabled={loading}>{loading ? "Создаем..." : "Создать администратора"}</button>
        </form>
        <div className="manager-card">
          <div className="manager-card__header"><div><span className="pill pill--soft">Список</span><h2>Зарегистрированные администраторы</h2></div></div>
          <div className="objection-list">
            {admins.map((admin) => (
              <article key={admin.id} className="objection-card">
                <div className="objection-card__meta">
                  <span className="pill">{admin.status === "active" ? "Активен" : "Отключен"}</span>
                  <span className="pill pill--soft">Тренировок: {admin.trainingCount}</span>
                </div>
                <h3>{admin.name}</h3>
                <p>{admin.email}</p>
                <small>Последняя тренировка: {admin.lastTrainingAt || "пока нет"}</small>
                <div className="objection-card__actions">
                  <button type="button" className="secondary-button" onClick={() => toggleStatus(admin.id, admin.status)}>{admin.status === "active" ? "Отключить" : "Активировать"}</button>
                  <button type="button" className="secondary-button" onClick={() => resetPassword(admin.id)}>Сбросить пароль</button>
                  <button type="button" className="secondary-button danger-button" onClick={() => deleteAdmin(admin.id, admin.name)}>Удалить</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
