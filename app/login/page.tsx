import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentSession } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCurrentSession();
  const params = await searchParams;

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero__copy">
          <span className="pill pill--soft">LEVITA</span>
          <h1>Отработка продаж в элегантном, но рабочем формате</h1>
          <p>
            Администратор тренируется в диалоге с клиенткой, а руководитель управляет библиотекой
            возражений и системным сценарием без выхода из интерфейса.
          </p>
        </div>

        <LoginForm errorMessage={params.error} />
      </section>
    </main>
  );
}
