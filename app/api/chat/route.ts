import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiSession } from "@/lib/auth";
import { streamTrainerReply } from "@/lib/trainer-engine";
import { chatRequestSchema, getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = requireApiSession(request, "admin");

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Доступ разрешен только администраторам." }, { status: 403 });
  }

  try {
    const body = chatRequestSchema.parse(await request.json());

    const result = await streamTrainerReply({
      messages: body.messages,
      scenario: body.scenario,
      trainingState: body.trainingState,
      phase: body.phase || "conversation",
      turnNumber: body.turnNumber,
    });

    const chunks: Uint8Array[] = [];

    if (result.stream) {
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    }

    const text = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    ).trim();

    return NextResponse.json({ mode: result.mode, reply: text });
  } catch (error) {
    const message =
      error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось получить ответ ИИ.";

    return NextResponse.json({ error: message }, { status: error instanceof ZodError ? 400 : 500 });
  }
}
