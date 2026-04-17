import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiSession } from "@/lib/auth";
import { createObjection, listObjections } from "@/lib/db";
import { getZodErrorMessage, managerObjectionCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = requireApiSession(request, "manager");
  if (!session) {
    return NextResponse.json({ error: "Только руководитель может видеть библиотеку." }, { status: 403 });
  }

  return NextResponse.json({ objections: await listObjections(session.email) });
}

export async function POST(request: Request) {
  const session = requireApiSession(request, "manager");
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
      city: session.city || session.name,
      ownerEmail: session.email,
    });

    return NextResponse.json({ objections });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось добавить возражение.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
