import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { setManagerStatus } from "@/lib/db";
import { getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "master") return NextResponse.json({ error: "Только master может управлять руководителями." }, { status: 403 });
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Некорректный id руководителя." }, { status: 400 });
  try {
    const body = patchSchema.parse(await request.json());
    const managers = await setManagerStatus(id, body.status);
    return NextResponse.json({ managers });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось обновить статус руководителя.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
