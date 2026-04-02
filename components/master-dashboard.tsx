"use client";

import { FormEvent, useMemo, useState } from "react";

type InviteRecord = {
  id: number;
  code: string;
  city: string;
  email: string | null;
  isUsed: boolean;
  createdAt: string;
  usedAt: string | null;
};

type ManagerRecord = {
  id: number;
  name: string;
  email: string;
  city: string;
  status: "active" | "disabled";
  createdAt: string;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export function MasterDashboard({ initialInvites, initialManagers }: { initialInvites: InviteRecord[]; initialManagers: ManagerRecord[] }) {
  const [invites, setInvites] = useState(initialInvites);
  const [managers, setManagers] = useState(initialManagers);
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [managerQuery, setManagerQuery] = useState("");
  const [managerStatusFilter, setManagerStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState<"all" | "active" | "used">("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => ({
    managers: managers.length,
    activeManagers: managers.filter((manager) => manager.status === "active").length,
    activeInvites: invites.filter((invite) => !invite.isUsed).length,
  }), [invites, managers]);

  const filteredManagers = useMemo(() => {
    const query = managerQuery.trim().toLowerCase();
    return managers.filter((manager) => {
      const matchesStatus = managerStatusFilter === "all" ? true : manager.status === managerStatusFilter;
      const haystack = `${manager.name} ${manager.email} ${manager.city}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [managerQuery, managerStatusFilter, managers]);

  const filteredInvites = useMemo(() => {
    const query = inviteQuery.trim().toLowerCase();
    return invites.filter((invite) => {
      const matchesStatus = inviteStatusFilter === "all" ? true : inviteStatusFilter === "used" ? invite.isUsed : !invite.isUsed;
      const haystack = `${invite.code} ${invite.city} ${invite.email || ""}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [inviteQuery, inviteStatusFilter, invites]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/master/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось создать инвайт-код.");
      setInvites(Array.isArray(payload.invites) ? payload.invites : []);
      setSuccess(payload.invite ? `Инвайт-код создан: ${payload.invite.code}` : "Инвайт-код создан.");
      setCity("");
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать инвайт-код.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleManagerStatus(manager: ManagerRecord) {
    setError("");
    setSuccess("");
    const nextStatus = manager.status === "active" ? "disabled" : "active";
    const response = await fetch(`/api/master/managers/${manager.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Не удалось обновить статус руководителя.");
      return;
    }
    setManagers(Array.isArray(payload.managers) ? payload.managers : []);
    setSuccess(nextStatus === "disabled" ? "Руководитель отключен." : "Руководитель активирован.");
  }

  async function copyInvite(invite: InviteRecord) {
    const text = `Город: ${invite.city}\nИнвайт-код: ${invite.code}${invite.email ? `\nEmail: ${invite.email}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`Инвайт ${invite.code} скопирован.`);
    } catch {
      setError("Не удалось скопировать инвайт-код.");
    }
  }

  return (
    <section className="manager-layout master-layout">
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <div className="stats-grid master-stats-grid">
        <article className="stat-card"><span>Всего руководителей</span><strong>{stats.managers}</strong></article>
        <article className="stat-card"><span>Активных руководителей</span><strong>{stats.activeManagers}</strong></article>
        <article className="stat-card"><span>Активных инвайтов</span><strong>{stats.activeInvites}</strong></article>
      </div>

      <div className="master-grid">
        <form className="manager-card master-card master-card--invite" onSubmit={handleCreate}>
          <div className="manager-card__header">
            <div>
              <span className="pill pill--soft">MASTER</span>
              <h2>Создать инвайт-код руководителя</h2>
              <p>Создавай доступ для нового города и при необходимости привязывай код к конкретному email партнера.</p>
            </div>
          </div>

          <div className="master-form-grid">
            <label><span>Город</span><input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="Например: Тюмень" required /></label>
            <label><span>Email руководителя</span><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Необязательно" /></label>
          </div>

          <button type="submit" className="primary-button" disabled={loading}>{loading ? "Создаем..." : "Создать инвайт"}</button>
        </form>

        <div className="manager-card master-card">
          <div className="manager-card__header">
            <div>
              <span className="pill pill--soft">Руководители</span>
              <h2>Аккаунты руководителей</h2>
              <p>Поиск, фильтрация и быстрое управление доступом партнёров по городам.</p>
            </div>
          </div>

          <div className="manager-filters master-filters">
            <input value={managerQuery} onChange={(e)=>setManagerQuery(e.target.value)} placeholder="Поиск по городу, имени или email" />
            <select value={managerStatusFilter} onChange={(e)=>setManagerStatusFilter(e.target.value as "all" | "active" | "disabled")}>
              <option value="all">Все статусы</option>
              <option value="active">Только активные</option>
              <option value="disabled">Только отключенные</option>
            </select>
          </div>

          <div className="objection-list master-list master-list--managers">
            {filteredManagers.map((manager) => (
              <article key={manager.id} className="objection-card master-record-card">
                <div className="objection-card__meta">
                  <span className="pill">{manager.city}</span>
                  <span className={`pill ${manager.status === "active" ? "pill--active" : "pill--inactive"}`}>{manager.status === "active" ? "Активен" : "Отключен"}</span>
                </div>
                <h3>{manager.name}</h3>
                <p>{manager.email}</p>
                <small>Создан: {dateFormatter.format(new Date(manager.createdAt))}</small>
                <div className="objection-card__actions">
                  <button type="button" className="secondary-button" onClick={() => toggleManagerStatus(manager)}>
                    {manager.status === "active" ? "Отключить" : "Активировать"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="manager-card master-card">
        <div className="manager-card__header">
          <div>
            <span className="pill pill--soft">Инвайты</span>
            <h2>Коды для регистрации руководителей</h2>
            <p>Можно быстро найти код, понять его статус и одним нажатием скопировать для отправки партнёру.</p>
          </div>
        </div>

        <div className="manager-filters master-filters">
          <input value={inviteQuery} onChange={(e)=>setInviteQuery(e.target.value)} placeholder="Поиск по коду, городу или email" />
          <select value={inviteStatusFilter} onChange={(e)=>setInviteStatusFilter(e.target.value as "all" | "active" | "used")}>
            <option value="all">Все инвайты</option>
            <option value="active">Только активные</option>
            <option value="used">Только использованные</option>
          </select>
        </div>

        <div className="objection-list master-list">
          {filteredInvites.map((invite) => (
            <article key={invite.id} className="objection-card master-record-card">
              <div className="objection-card__meta">
                <span className="pill">{invite.city}</span>
                <span className={`pill ${invite.isUsed ? "pill--inactive" : "pill--active"}`}>{invite.isUsed ? "Использован" : "Активен"}</span>
              </div>
              <h3>{invite.code}</h3>
              <p>{invite.email || "Без привязки к email"}</p>
              <small>Создан: {dateFormatter.format(new Date(invite.createdAt))}{invite.usedAt ? ` · Использован: ${dateFormatter.format(new Date(invite.usedAt))}` : ""}</small>
              <div className="objection-card__actions">
                <button type="button" className="secondary-button" onClick={() => copyInvite(invite)}>Скопировать</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
