import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, type Permission } from "@/lib/permissions";
import { getAuthSecretKey, sessionCookieName } from "@/lib/session";

type SessionPayload = {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAuthSecretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecretKey());
  return payload as SessionPayload;
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  try {
    const session = await verifySessionToken(token);
    const user = await prisma.user.findFirst({
      where: { id: session.userId, tenantId: session.tenantId, isActive: true },
      select: { id: true, tenantId: true, email: true, name: true, role: true },
    });
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(permission?: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) redirect("/dashboard");
  return user;
}
