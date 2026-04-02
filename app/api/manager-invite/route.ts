import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createManagerInvite } from "@/lib/db";
import { getZodErrorMessage, managerInviteCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = managerInviteCreateSchema.parse(await request.json());
    const invite = await createManagerInvite({ city: body.city, email: body.email || undefined });
    return NextResponse.json({ invite });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось создать инвайт.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
