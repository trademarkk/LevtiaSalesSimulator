import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { attachSessionCookie } from "@/lib/auth";
import { createManagerUserFromInvite } from "@/lib/db";
import { getZodErrorMessage, managerRegisterSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJsonRequest = contentType.includes("application/json");

  function fail(message: string) {
    if (isJsonRequest) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.redirect(new URL(`/register?type=manager&error=${encodeURIComponent(message)}`, request.url), { status: 303 });
  }

  try {
    const payload = isJsonRequest ? await request.json() : Object.fromEntries((await request.formData()).entries());
    const body = managerRegisterSchema.parse(payload);
    const user = await createManagerUserFromInvite({ code: body.code, city: body.city, email: body.email, password: body.password });
    if (!user) throw new Error("Не удалось зарегистрировать руководителя.");
    const response = isJsonRequest ? NextResponse.json({ ok: true }) : NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    attachSessionCookie(response, { userId: user.id, email: user.email, name: user.name, city: user.city, role: user.role });
    return response;
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось зарегистрировать руководителя.";
    return fail(message);
  }
}
