import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { createAdminUser, listAdminAccounts } from "@/lib/db";
import { getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const createAdminSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может видеть администраторов." }, { status: 403 });
  return NextResponse.json({ admins: await listAdminAccounts(session.city || session.name) });
}

export async function POST(request: Request) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может создавать администраторов." }, { status: 403 });
  try {
    const body = createAdminSchema.parse(await request.json());
    const city = session.city || session.name;
    const user = await createAdminUser({ city, name: body.name, email: body.email, password: body.password });
    return NextResponse.json({ ok: true, user, admins: await listAdminAccounts(city) });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось создать администратора.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
