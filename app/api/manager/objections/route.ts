import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { createObjection, listObjections } from "@/lib/db";
import { getZodErrorMessage, managerObjectionCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

function getManagerSession(cookieHeader: string | null) {
  const session = getSessionFromCookie(parseSessionCookie(cookieHeader));
  return session?.role === "manager" ? session : null;
}

export async function GET(request: Request) {
  const session = getManagerSession(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Только руководитель может видеть библиотеку." }, { status: 403 });
  }

  return NextResponse.json({ objections: await listObjections(session.name) });
}

export async function POST(request: Request) {
  const session = getManagerSession(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Только руководитель может добавлять шаблоны." }, { status: 403 });
  }

  try {
    const body = managerObjectionCreateSchema.parse(await request.json());
    const objections = await createObjection({
      title: body.title,
      objectionText: body.objectionText,
      coachHint: body.coachHint,
      stage: body.stage,
      difficulty: body.difficulty,
      isActive: body.isActive,
      isRequired: body.isRequired,
      city: session.name,
    });

    return NextResponse.json({ objections });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось добавить возражение.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
