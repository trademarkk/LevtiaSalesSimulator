import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "scenario-debug disabled" }, { status: 410 });
}
