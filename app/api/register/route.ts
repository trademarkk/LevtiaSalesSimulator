import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { attachSessionCookie } from "@/lib/auth";
import { createAdminUser } from "@/lib/db";
import { getZodErrorMessage, registerRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJsonRequest = contentType.includes("application/json");

  function buildFailureResponse(message: string, status = 400) {
    if (isJsonRequest) {
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.redirect(new URL(`/register?type=admin&error=${encodeURIComponent(message)}`, request.url), { status: 303 });
  }

  try {
    const payload = isJsonRequest ? await request.json() : Object.fromEntries((await request.formData()).entries());
    const body = registerRequestSchema.parse(payload);
    const user = await createAdminUser({ city: body.city, email: body.email, password: body.password });
    if (!user) throw new Error("Не удалось создать пользователя.");

    const response = isJsonRequest ? NextResponse.json({ ok: true }) : NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    attachSessionCookie(response, { userId: user.id, email: user.email, name: user.name, city: user.city, role: user.role });
    return response;
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось зарегистрироваться.";
    return buildFailureResponse(message, 400);
  }
}
