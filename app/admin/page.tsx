import { AppShell } from "@/components/app-shell";
import { ChatTrainerStepLive } from "@/components/chat-trainer-step-live";
import { requireSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await requireSession("admin");

  return (
    <AppShell
      eyebrow="LEVITA Simulator"
      title="Тренировка администратора"
      description="ИИ ведет себя как клиентка после пробного занятия и использует возражения из базы руководителя."
      roleLabel="Администратор"
      userName={session.name}
    >
      <ChatTrainerStepLive userName={session.name} adminDisplayName={session.name} />
    </AppShell>
  );
}
