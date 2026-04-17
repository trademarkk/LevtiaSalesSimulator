import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth";
import { buildScenario } from "@/lib/trainer-engine";
import { getUserById } from "@/lib/db";
import { getZodErrorMessage, scenarioRequestSchema } from "@/lib/validation";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = requireApiSession(request, "admin");

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Только администратор может запускать тренировку." }, { status: 403 });
  }

  const user = await getUserById(session.userId);
  const ownerEmail = user?.managerEmail || session.managerEmail || session.email;

  try {
    let payload = {};

    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const body = scenarioRequestSchema.parse(payload);

    const scenario = await buildScenario({
      city: session.city || session.name,
      ownerEmail,
      difficulty: body.difficulty || "medium",
      stepCount: body.stepCount,
    });

    return NextResponse.json({ scenario });
  } catch (error) {
    const message =
      error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось собрать сценарий.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
