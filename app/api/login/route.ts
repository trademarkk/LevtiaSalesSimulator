import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { attachSessionCookie } from "@/lib/auth";
import { getUserByEmail, verifyPassword } from "@/lib/db";
import { getZodErrorMessage, loginRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJsonRequest = contentType.includes("application/json");

  function buildFailureResponse(message: string, status = 400) {
    if (isJsonRequest) {
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }

  try {
    const payload = isJsonRequest
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

    const body = loginRequestSchema.parse(payload);
    const user = await getUserByEmail(body.email);

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return buildFailureResponse("Неверный логин или пароль.", 401);
    }

    if (user.status === "disabled") {
      return buildFailureResponse("Этот аккаунт отключен. Обратитесь к руководителю.", 403);
    }

    const response = isJsonRequest
      ? NextResponse.json({ ok: true })
      : NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });

    attachSessionCookie(response, {
      userId: user.id,
      email: user.email,
      name: user.name,
      city: user.city,
      role: user.role,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Укажите email и пароль.";

    return buildFailureResponse(message, 400);
  }
}
