import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import { getZodErrorMessage, managerSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));

  if (!session || session.role !== "manager") {
    return NextResponse.json({ error: "Только руководитель может видеть настройки." }, { status: 403 });
  }

  return NextResponse.json({ prompt: await getSetting("trainer_prompt", session.name) });
}

export async function PUT(request: Request) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));

  if (!session || session.role !== "manager") {
    return NextResponse.json({ error: "Только руководитель может редактировать промпт." }, { status: 403 });
  }

  try {
    const body = managerSettingsSchema.parse(await request.json());
    const prompt = await setSetting("trainer_prompt", body.trainerPrompt, session.name);
    return NextResponse.json({ prompt });
  } catch (error) {
    const message =
      error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Промпт не может быть пустым.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
