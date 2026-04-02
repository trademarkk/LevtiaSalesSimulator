import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { getTrainingSessionById } from "@/lib/db";

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

type PageProps = {
  params: Promise<{
    adminName: string;
    sessionId: string;
  }>;
};

export default async function TrainingSessionDetailPage({ params }: PageProps) {
  const session = await requireSession("manager");
  const { adminName, sessionId } = await params;
  const resolvedName = decodeName(adminName);
  const trainingId = Number(sessionId);

  if (!Number.isFinite(trainingId)) {
    notFound();
  }

  const training = await getTrainingSessionById(trainingId, session.name);

  if (!training || training.adminDisplayName !== resolvedName) {
    notFound();
  }

  return (
    <AppShell
      eyebrow="LEVITA Control Room"
      title={`Тренировка ${dateFormatter.format(new Date(training.completedAt))}`}
      description="Здесь сохранены итоговый разбор и полная переписка администратора с ИИ-клиенткой."
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
            <span>Администратор</span>
            <strong>{training.adminDisplayName}</strong>
          </article>

          <article className="stat-card">
            <span>Результат</span>
            <strong>{training.score !== null ? `${training.score}/10` : "Без оценки"}</strong>
          </article>

          <article className="stat-card">
            <span>Параметры</span>
            <strong>
              {training.scenarioDifficulty}, {training.stepCount} шагов
            </strong>
          </article>
        </div>

        <div className="history-stack">
          <Link
            href={`/manager/trainings/${encodeURIComponent(training.adminDisplayName)}`}
            className="secondary-button history-back"
          >
            К тренировкам администратора
          </Link>

          <div className="manager-card">
            <div className="manager-card__header">
              <div>
                <span className="pill pill--soft">Итоговый разбор</span>
                <h2>Результат тренировки</h2>
              </div>
            </div>

            <p>
              Завершена: {dateFormatter.format(new Date(training.completedAt))}. Режим модели:{" "}
              {training.trainerMode}.
            </p>

            <div className="trainer-result">
              <pre>{training.evaluationText}</pre>
            </div>
          </div>

          <div className="manager-card">
            <div className="manager-card__header">
              <div>
                <span className="pill pill--soft">Переписка</span>
                <h2>Диалог администратора и клиентки</h2>
              </div>
            </div>

            <div className="session-transcript">
              {training.transcript.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`message-bubble ${
                    message.role === "assistant" ? "message-bubble--assistant" : "message-bubble--user"
                  }`}
                >
                  <span>{message.role === "assistant" ? "Клиентка" : `Администратор${message.inputSource ? ` · ${message.inputSource === 'voice' ? 'голос' : 'вручную'}` : ''}`}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
