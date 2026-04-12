import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { getObjectionsByIds, getUserById } from "@/lib/db";
import { buildConversationPrompt } from "@/lib/trainer-engine";
import { chatRequestSchema, getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromCookie(request.headers.get("cookie")?.match(/levita_session=([^;]+)/)?.[1]);

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Доступ разрешен только администраторам." }, { status: 403 });
  }

  const user = await getUserById(session.userId);
  const ownerEmail = user?.managerEmail || session.managerEmail || session.email;

  try {
    const body = chatRequestSchema.parse(await request.json());
    const turnNumber = body.turnNumber || 1;
    const objections = await getObjectionsByIds(body.scenario.objectionIds, ownerEmail || body.scenario.ownerEmail);
    const currentObjection = objections[Math.min(turnNumber - 1, objections.length - 1)];

    if (!currentObjection) {
      return NextResponse.json({ error: "Не удалось определить текущее возражение для preview." }, { status: 400 });
    }

    const prompt = await buildConversationPrompt({
      scenario: {
        ...body.scenario,
        ownerEmail: ownerEmail || body.scenario.ownerEmail,
      },
      currentObjection,
      messages: body.messages,
      turnNumber,
      trainingState: body.trainingState,
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    const message =
      error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось собрать prompt preview.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
