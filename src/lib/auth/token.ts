import { createHmac, timingSafeEqual } from "crypto";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === "production") return null;
  return "trapmas-dev";
}

export function sessionSecret(): string | null {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.NODE_ENV === "production") return null;
  return "dev-only-session-secret";
}

export function passwordsMatch(input: string, expected: string): boolean {
  const actual = Buffer.from(input);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export function signAdminSession(secret: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: now + SEVEN_DAYS_MS }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAdminSession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === "admin" && typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}

const loginFailures = new Map<string, { count: number; resetAt: number }>();

export function loginAllowed(ip: string, now = Date.now()): boolean {
  const entry = loginFailures.get(ip);
  if (!entry || entry.resetAt < now) return true;
  return entry.count < 5;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const entry = loginFailures.get(ip);
  if (!entry || entry.resetAt < now) {
    loginFailures.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string): void {
  loginFailures.delete(ip);
}
