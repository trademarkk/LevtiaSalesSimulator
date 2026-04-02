import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getUserById } from "@/lib/db";
import { getSessionSecret } from "@/lib/env";
import type { SessionPayload, UserRole } from "@/lib/types";

const sessionCookieName = "levita_session";
const sessionTtlMs = 1000 * 60 * 60 * 12;

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodeSession(session: SessionPayload) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function decodeSession(rawValue: string | undefined | null) {
  if (!rawValue) {
    return null;
  }

  const [payload, signature] = rawValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;

    if (Date.now() > session.exp) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function attachSessionCookie(
  response: NextResponse,
  session: Omit<SessionPayload, "exp">,
) {
  const encoded = encodeSession({
    ...session,
    exp: Date.now() + sessionTtlMs,
  });

  response.cookies.set(sessionCookieName, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtlMs / 1000,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(sessionCookieName)?.value);
}

export function getSessionFromCookie(rawCookie: string | undefined | null) {
  return decodeSession(rawCookie);
}

export async function requireSession(role?: UserRole) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const user = await getUserById(session.userId);

  if (!user) {
    redirect("/login");
  }

  if (role && user.role !== role) {
    redirect(user.role === "manager" ? "/manager" : "/admin");
  }

  return {
    ...session,
    role: user.role,
    name: user.name,
    city: user.city,
    email: user.email,
  } satisfies SessionPayload;
}
