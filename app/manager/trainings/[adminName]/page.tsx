import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { listTrainingSessionsByAdministrator } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

function decodeName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getEvaluationSummary(evaluationText: string) {
  const firstMeaningfulLine = evaluationText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstMeaningfulLine || "Разбор сохранен.";
}

type PageProps = {
  params: Promise<{
    adminName: string;
  }>;
};

export default async function ManagerAdministratorTrainingsPage({ params }: PageProps) {
  const session = await requireSession("manager");
  const { adminName } = await params;
  const resolvedName = decodeName(adminName);
  const sessions = await listTrainingSessionsByAdministrator(resolvedName, session.name);

  if (!sessions.length) {
    notFound();
  }

  const scoredSessions = sessions.filter((item: any) => item.score !== null);
  const averageScore =
    scoredSessions.length > 0
      ? scoredSessions.reduce((sum: number, item: any) => sum + (item.score || 0), 0) / scoredSessions.length
      : null;

  return (
    <AppShell
      eyebrow="LEVITA Control Room"
      title={resolvedName}
      description="Ниже собраны все завершенные тренировки этого администратора. Открывайте нужную дату, чтобы посмотреть разбор и переписку целиком."
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
            <span>Тренировок</span>
            <strong>{sessions.length}</strong>
          </article>

          <article className="stat-card">
            <span>Средняя оценка</span>
            <strong>{averageScore !== null ? averageScore.toFixed(1) : "—"}</strong>
          </article>

          <article className="stat-card">
            <span>Последняя тренировка</span>
            <strong>{dateFormatter.format(new Date(sessions[0].completedAt))}</strong>
          </article>
        </div>

        <div className="history-stack">
          <Link href="/manager/trainings" className="secondary-button history-back">
            Ко всем администраторам
          </Link>

          {sessions.map((training: any) => (
            <Link
              key={training.id}
              href={`/manager/trainings/${encodeURIComponent(resolvedName)}/${training.id}`}
              className="history-card"
            >
              <div className="history-card__meta">
                <span className="pill pill--soft">{dateFormatter.format(new Date(training.completedAt))}</span>
                <span>Шагов: {training.stepCount}</span>
                <span>Сложность: {training.scenarioDifficulty}</span>
                <span>Режим: {training.trainerMode}</span>
              </div>

              <h2>
                {training.score !== null ? `Оценка ${training.score}/10` : "Оценка не выделена"}
              </h2>
              <p>{getEvaluationSummary(training.evaluationText)}</p>

              <strong>Открыть тренировку</strong>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
