import Link from "next/link";

type LoginFormProps = {
  errorMessage?: string;
};

export function LoginForm({ errorMessage }: LoginFormProps) {
  return (
    <div className="login-card">
      <div className="login-card__intro">
        <span className="pill pill--soft">LEVITA</span>
        <h2>Вход в тренажер продаж</h2>
        <p>
          Руководитель входит в свой кабинет и управляет библиотекой возражений, промптом,
          администраторами и историей тренировок. Администраторы входят под своими персональными аккаунтами.
        </p>
      </div>

      <form className="login-form" action="/api/login" method="post">
        <label>
          <span>Email</span>
          <input type="email" name="email" placeholder="you@example.com" required />
        </label>

        <label>
          <span>Пароль</span>
          <input type="password" name="password" placeholder="Введите пароль" required />
        </label>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <button type="submit" className="primary-button">
          Войти
        </button>
      </form>

      <p className="auth-switch">Новый руководитель? <Link href="/register?type=manager">Зарегистрироваться по инвайт-коду</Link></p>
    </div>
  );
}
