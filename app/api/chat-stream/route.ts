import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { streamTrainerReply } from "@/lib/trainer-engine";
import { chatRequestSchema, getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

function getReadableErrorMessage(error: unknown) {
  const candidate = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  const message = candidate?.message || "";

  if (/openrouter/i.test(message) && candidate?.status === 401) {
    return "OpenRouter не принял API-ключ. Проверьте OPENROUTER_API_KEY в файле .env.";
  }

  if (/openrouter/i.test(message) && candidate?.status === 429) {
    return "OpenRouter временно ограничил запросы по бесплатной модели. Попробуйте еще раз чуть позже.";
  }

  if (/openrouter/i.test(message) && candidate?.status === 402) {
    return "OpenRouter вернул 402. Для бесплатного режима используйте модель openrouter/free и проверьте, что ключ активен.";
  }

  if (candidate?.status === 402 || /insufficient balance/i.test(message)) {
    return "DeepSeek вернул 402 Insufficient Balance. На аккаунте или API-ключе закончился баланс. Пополните баланс в кабинете DeepSeek.";
  }

  if (candidate?.status === 401) {
    return "DeepSeek не принял API-ключ. Проверьте DEEPSEEK_API_KEY в файле .env.";
  }

  if (candidate?.status === 429) {
    return "DeepSeek временно ограничил запросы. Попробуйте еще раз чуть позже.";
  }

  return error instanceof Error ? error.message : "Не удалось получить ответ ИИ.";
}

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Доступ разрешен только администраторам." }, { status: 403 });
  }

  try {
    const body = chatRequestSchema.parse(await request.json());
    const phase = body.phase || "conversation";

    const result = await streamTrainerReply({
      messages: body.messages,
      scenario: body.scenario,
      trainingState: body.trainingState,
      phase,
      turnNumber: body.turnNumber,
    });

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "x-trainer-mode": result.mode,
      },
    });
  } catch (error) {
    const message =
      error instanceof ZodError ? getZodErrorMessage(error) : getReadableErrorMessage(error);

    return NextResponse.json({ error: message }, { status: error instanceof ZodError ? 400 : 500 });
  }
}
