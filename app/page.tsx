import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-page">
      <section className="hero">
        <div className="hero__content">
          <span className="pill pill--soft">LEVITA · Sales Training</span>
          <h1>Тренажер отработки возражений для администраторов студии</h1>
          <p>
            Локальный сайт, где администратор продает абонемент в чате с ИИ-клиентом, а
            руководитель вручную наполняет библиотеку возражений и управляет логикой тренажера.
          </p>

          <div className="hero__actions">
            <Link href="/login" className="primary-button">
              Войти в систему
            </Link>
            <a href="#features" className="secondary-button">
              Войти в систему
            </a>
          </div>
        </div>

        <div className="hero__card">
          <span className="pill">MVP для локального запуска</span>
          <h2>Что уже умеет сайт</h2>
          <ul>
            <li>2 роли доступа: администратор и руководитель.</li>
            <li>Чат с ИИ-клиентом после пробного занятия.</li>
            <li>SQLite-база возражений, которую наполняет руководитель.</li>
            <li>Базовый промпт тренажера редактируется из кабинета руководителя.</li>
          </ul>
        </div>
      </section>

      <section className="feature-section" id="features">
        <div className="section-heading">
          <span className="pill pill--soft">Архитектура</span>
          <h2>Сайт уже собран под реальный рабочий сценарий</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <h3>Кабинет администратора</h3>
            <p>
              Только тренировка продаж: запуск нового сценария, чат с клиенткой и отработка
              возражений без доступа к настройкам.
            </p>
          </article>

          <article className="feature-card">
            <h3>Кабинет руководителя</h3>
            <p>
              Добавление новых возражений, включение и выключение шаблонов, редактирование
              базового промпта для ИИ.
            </p>
          </article>

          <article className="feature-card">
            <h3>ИИ и база знаний</h3>
            <p>
              Для каждого нового диалога собирается сценарий на основе активных записей из
              библиотеки возражений.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
