import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "Маршрут отключен. Используйте защищенный POST /api/master/invites от имени master.",
    },
    { status: 410 },
  );
}
