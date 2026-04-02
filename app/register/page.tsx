import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getCurrentSession();
  const params = await searchParams;
  if (session) redirect('/dashboard');

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero__copy">
          <span className="pill pill--soft">LEVITA</span>
          <h1>Регистрация руководителя</h1>
          <p>Руководитель регистрируется по инвайт-коду и уже внутри кабинета создает администраторов своего города.</p>
        </div>
        <div className="login-card">
          <div className="login-card__intro">
            <span className="pill pill--soft">Только по приглашению</span>
            <h2>Создать аккаунт руководителя</h2>
            <p>Введите инвайт-код, город, email и пароль. Администраторов после этого вы создадите внутри кабинета.</p>
          </div>
          <form className="login-form" action="/api/register-manager" method="post">
            <label><span>Инвайт-код</span><input type="text" name="code" required /></label>
            <label><span>Город</span><input type="text" name="city" placeholder="Например: Краснодар" required /></label>
            <label><span>Email</span><input type="email" name="email" placeholder="manager@example.com" required /></label>
            <label><span>Пароль</span><input type="password" name="password" placeholder="Минимум 6 символов" required /></label>
            <label><span>Подтверждение пароля</span><input type="password" name="confirmPassword" placeholder="Повторите пароль" required /></label>
            {params.error ? <p className="form-error">{params.error}</p> : null}
            <button type="submit" className="primary-button">Зарегистрировать руководителя</button>
          </form>
          <p className="auth-switch">Уже есть аккаунт? <Link href="/login">Войти</Link></p>
        </div>
      </section>
    </main>
  );
}
