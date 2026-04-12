import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSessionFromCookie } from "@/lib/auth";
import { deleteObjection, setObjectionActive, setObjectionRequired, updateObjection } from "@/lib/db";
import { getZodErrorMessage, managerObjectionToggleSchema, managerObjectionUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

function parseSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/levita_session=([^;]+)/);
  return match?.[1] ?? null;
}

async function getValidatedId(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const objectionId = Number(params.id);
  return Number.isFinite(objectionId) ? objectionId : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может менять шаблоны." }, { status: 403 });
  const objectionId = await getValidatedId(context);
  if (!objectionId) return NextResponse.json({ error: "Некорректный идентификатор шаблона." }, { status: 400 });

  try {
    const rawBody = await request.json();
    if (typeof rawBody?.isRequired === "boolean") {
      const objections = await setObjectionRequired(objectionId, rawBody.isRequired, session.email);
      return NextResponse.json({ objections });
    }
    const body = managerObjectionToggleSchema.parse(rawBody);
    const objections = await setObjectionActive(objectionId, body.isActive, session.email);
    return NextResponse.json({ objections });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось обновить шаблон.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может редактировать шаблоны." }, { status: 403 });
  const objectionId = await getValidatedId(context);
  if (!objectionId) return NextResponse.json({ error: "Некорректный идентификатор шаблона." }, { status: 400 });

  try {
    const body = managerObjectionUpdateSchema.parse(await request.json());
    const objections = await updateObjection(objectionId, { ...body, city: session.city || session.name, ownerEmail: session.email });
    return NextResponse.json({ objections });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось сохранить шаблон.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = getSessionFromCookie(parseSessionCookie(request.headers.get("cookie")));
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может удалять шаблоны." }, { status: 403 });
  const objectionId = await getValidatedId(context);
  if (!objectionId) return NextResponse.json({ error: "Некорректный идентификатор шаблона." }, { status: 400 });
  const objections = await deleteObjection(objectionId, session.email);
  return NextResponse.json({ objections });
}
