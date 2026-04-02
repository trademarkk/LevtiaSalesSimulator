import { AppShell } from "@/components/app-shell";
import { ManagerDashboard } from "@/components/manager-dashboard";
import { requireSession } from "@/lib/auth";
import { ensureCityData, getSetting, listObjections } from "@/lib/db";

export default async function ManagerPage() {
  const session = await requireSession("manager");
  const city = session.city || session.name;
  await ensureCityData(city);
  const objections = await listObjections(city);
  const trainerPrompt = await getSetting("trainer_prompt", city);

  return (
    <AppShell
      eyebrow="LEVITA Control Room"
      title="Кабинет руководителя"
      description="Управляйте библиотекой возражений и базовой логикой тренажера для администраторов."
      roleLabel="Руководитель"
      userName={session.name}
      navigationItems={[
        { href: "/manager", label: "Настройки", active: true },
        { href: "/manager/admins", label: "Администраторы" },
        { href: "/manager/trainings", label: "Тренировки" },
      ]}
    >
      <ManagerDashboard
        initialObjections={objections}
        initialPrompt={trainerPrompt}
        openAiEnabled={Boolean(process.env.OPENAI_API_KEY)}
      />
    </AppShell>
  );
}
