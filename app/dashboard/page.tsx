import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await requireSession();
  redirect(session.role === "manager" ? "/manager" : "/admin");
}
