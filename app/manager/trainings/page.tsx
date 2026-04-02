import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { listTrainingAdministrators } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function ManagerTrainingsPage() {
  const session = await requireSession("manager");
  const administrators = await listTrainingAdministrators(session.name);
  const totalSessions = administrators.reduce((sum: number, item: any) => sum + item.sessionCount, 0);

  return (
    <AppShell
      eyebrow="LEVITA Control Room"
      title="История Тренировок"
      description="Смотрите, как администраторы проходили тренировки, какие результаты получали и к каким диалогам нужно вернуться."
      roleLabel="Руководитель"
      userName={session.name}
      navigationItems={[
        { href: "/manager", label: "Настройки" },
        { href: "/manager/admins", label: "Администраторы" },
        { href: "/manager/trainings", label: "Тренировки", active: true },
      ]}
    >
      <section className="manager-layout">
        <div className="stats-grid">
          <article className="stat-card">
            <span>Администраторов в истории</span>
            <strong>{administrators.length}</strong>
          </article>

          <article className="stat-card">
            <span>Всего тренировок</span>
            <strong>{totalSessions}</strong>
          </article>

          <article className="stat-card">
            <span>Последняя запись</span>
            <strong>
              {administrators[0]?.lastCompletedAt
                ? dateFormatter.format(new Date(administrators[0].lastCompletedAt))
                : "Пока нет"}
            </strong>
          </article>
        </div>

        {administrators.length === 0 ? (
          <div className="manager-card history-empty">
            <h2>История пока пуста</h2>
            <p>
              Как только администраторы начнут завершать тренировки, здесь появятся их имена,
              результаты и быстрый переход к каждой переписке.
            </p>
          </div>
        ) : (
          <div className="history-grid">
            {administrators.map((administrator: any) => (
              <Link
                key={administrator.adminDisplayName}
                href={`/manager/trainings/${encodeURIComponent(administrator.adminDisplayName)}`}
                className="history-card"
              >
                <div className="history-card__meta">
                  <span className="pill pill--soft">Администратор</span>
                  <span>{dateFormatter.format(new Date(administrator.lastCompletedAt))}</span>
                </div>

                <h2>{administrator.adminDisplayName}</h2>
                <p>
                  Тренировок: {administrator.sessionCount}. Средняя оценка:{" "}
                  {administrator.averageScore !== null ? administrator.averageScore.toFixed(1) : "—"}.
                </p>

                <strong>Открыть историю тренировок</strong>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
