import { AppShell } from "@/components/app-shell";
import { ManagerAdminsPanel } from "@/components/manager-admins-panel";
import { requireSession } from "@/lib/auth";
import { listAdminAccounts } from "@/lib/db";

export default async function ManagerAdminsPage() {
  const session = await requireSession('manager');
  const admins = (await listAdminAccounts(session.city || session.name)).map((row: any) => ({
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    city: String(row.city),
    status: String(row.status || 'active') as 'active' | 'disabled',
    trainingCount: Number(row.training_count || 0),
    lastTrainingAt: row.last_training_at ? String(row.last_training_at) : null,
    createdAt: String(row.created_at),
  }));

  return (
    <AppShell
      eyebrow="LEVITA Control Room"
      title="Администраторы"
      description="Создавайте аккаунты администраторов внутри своего города и отслеживайте их тренировки."
      roleLabel="Руководитель"
      userName={session.name}
      navigationItems={[
        { href: "/manager", label: "Настройки" },
        { href: "/manager/admins", label: "Администраторы", active: true },
        { href: "/manager/trainings", label: "Тренировки" },
      ]}
    >
      <ManagerAdminsPanel initialAdmins={admins} />
    </AppShell>
  );
}
