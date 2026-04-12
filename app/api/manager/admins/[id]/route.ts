import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { deleteAdminAccount, listAdminAccounts, resetAdminPassword, setAdminStatus } from "@/lib/db";
import { getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["active", "disabled"]).optional(),
  resetPassword: z.string().min(6).optional(),
});

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может управлять администраторами." }, { status: 403 });
  const params = await context.params;
  const id = Number(params.id);
  const ownerEmail = session.email;
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Некорректный id администратора." }, { status: 400 });
  try {
    const body = patchSchema.parse(await request.json());
    if (body.status) {
      const admins = await setAdminStatus(id, ownerEmail, body.status);
      return NextResponse.json({ admins });
    }
    if (body.resetPassword) {
      await resetAdminPassword(id, ownerEmail, body.resetPassword);
      return NextResponse.json({ ok: true, admins: await listAdminAccounts(ownerEmail) });
    }
    return NextResponse.json({ error: "Нет данных для обновления." }, { status: 400 });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось обновить администратора.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может удалять администраторов." }, { status: 403 });
  const params = await context.params;
  const id = Number(params.id);
  const ownerEmail = session.email;
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Некорректный id администратора." }, { status: 400 });
  const admins = await deleteAdminAccount(id, ownerEmail);
  return NextResponse.json({ admins });
}
