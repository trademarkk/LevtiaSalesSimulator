import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiSession } from "@/lib/auth";
import { createTrainingSession, deleteTrainingSessionsById, getUserById } from "@/lib/db";
import { getZodErrorMessage, trainingSessionCreateSchema, trainingSessionDeleteSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = requireApiSession(request, "admin");
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Только администратор может сохранять тренировку." }, { status: 403 });
  }

  const user = await getUserById(session.userId);
  const ownerEmail = user?.managerEmail || session.managerEmail || session.email;

  try {
    const body = trainingSessionCreateSchema.parse(await request.json());
    await createTrainingSession({
      adminDisplayName: body.adminDisplayName,
      adminUserId: session.userId,
      city: session.city || session.name,
      ownerEmail,
      scenario: body.scenario,
      trainerMode: body.trainerMode,
      evaluationText: body.evaluationText,
      transcript: body.messages,
      startedAt: body.startedAt || new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось распознать данные завершенной тренировки.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = requireApiSession(request, "manager");
  if (!session || session.role !== "manager") {
    return NextResponse.json({ error: "Только руководитель может удалять сессии тренировок." }, { status: 403 });
  }

  try {
    const body = trainingSessionDeleteSchema.parse(await request.json());
    const deletedCount = await deleteTrainingSessionsById([...new Set(body.ids)], session.email);
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Нужно передать хотя бы один id тренировки.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
