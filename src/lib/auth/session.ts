import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { readAdminSession, sessionSecret, signAdminSession } from "@/lib/auth/token";

export const ADMIN_COOKIE = "trapmas_admin";

export async function getSession(): Promise<{ role: "admin" } | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!readAdminSession(token, secret)) return null;
  return { role: "admin" };
}

export async function requireAdmin(): Promise<{ role: "admin" }> {
  const session = await getSession();
  if (!session) throw new AppError(401, "Sign in to the admin dashboard.", "unauthorized");
  return session;
}

export async function setAdminCookie(): Promise<void> {
  const secret = sessionSecret();
  if (!secret) {
    throw new AppError(503, "Set ADMIN_SESSION_SECRET before signing in.", "not_configured");
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, signAdminSession(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}
