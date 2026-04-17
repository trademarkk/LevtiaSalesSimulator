import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiSession } from "@/lib/auth";
import { createManagerInvite, listManagerInvites } from "@/lib/db";
import { getZodErrorMessage, masterInviteCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = requireApiSession(request, "master");
  if (!session || session.role !== "master") return NextResponse.json({ error: "Только master может видеть инвайты." }, { status: 403 });
  return NextResponse.json({ invites: await listManagerInvites() });
}

export async function POST(request: Request) {
  const session = requireApiSession(request, "master");
  if (!session || session.role !== "master") return NextResponse.json({ error: "Только master может создавать инвайты." }, { status: 403 });
  try {
    const body = masterInviteCreateSchema.parse(await request.json());
    const invite = await createManagerInvite({ city: body.city, email: body.email || undefined });
    return NextResponse.json({ invite, invites: await listManagerInvites() });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось создать инвайт-код.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
