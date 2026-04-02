import { AppShell } from "@/components/app-shell";
import { MasterDashboard } from "@/components/master-dashboard";
import { requireSession } from "@/lib/auth";
import { listManagerAccounts, listManagerInvites } from "@/lib/db";

export default async function MasterPage() {
  const session = await requireSession("master");
  const invites = await listManagerInvites();
  const managers = await listManagerAccounts();

  return (
    <AppShell
      eyebrow="LEVITA Master"
      title="Мастер-кабинет"
      description="Создавайте инвайт-коды для новых руководителей и контролируйте подключение городов."
      roleLabel="Master"
      userName={session.email}
      navigationItems={[{ href: "/master", label: "Инвайты и руководители", active: true }]}
    >
      <MasterDashboard initialInvites={invites as any} initialManagers={managers as any} />
    </AppShell>
  );
}
