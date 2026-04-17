import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { requireApiSession } from "@/lib/auth";
import { createAdminUser, getUserById, listAdminAccounts } from "@/lib/db";
import { getZodErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const createAdminSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

export async function GET(request: Request) {
  const session = requireApiSession(request, "manager");
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может видеть администраторов." }, { status: 403 });
  const user = await getUserById(session.userId);
  const ownerEmail = user?.email || session.email;
  return NextResponse.json({ admins: await listAdminAccounts(ownerEmail) });
}

export async function POST(request: Request) {
  const session = requireApiSession(request, "manager");
  if (!session || session.role !== "manager") return NextResponse.json({ error: "Только руководитель может создавать администраторов." }, { status: 403 });
  const user = await getUserById(session.userId);
  const ownerEmail = user?.email || session.email;
  try {
    const body = createAdminSchema.parse(await request.json());
    const city = user?.city || session.city || session.name;
    const createdUser = await createAdminUser({ city, name: body.name, email: body.email, password: body.password, managerEmail: ownerEmail });
    return NextResponse.json({ ok: true, user: createdUser, admins: await listAdminAccounts(ownerEmail) });
  } catch (error) {
    const message = error instanceof ZodError ? getZodErrorMessage(error) : error instanceof Error ? error.message : "Не удалось создать администратора.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
