import { createHash, createHmac, timingSafeEqual } from "crypto";

export const SKEW_MS = 5 * 60 * 1000;

export function signRequest(input: { secret: string; timestamp: string; method: string; path: string; body: Buffer }): string {
  const payload = `${input.timestamp}\n${input.method.toUpperCase()}\n${input.path}\n${createHash("sha256").update(input.body).digest("hex")}`;
  return createHmac("sha256", input.secret).update(payload).digest("hex");
}

export function verifyRequest(input: {
  secret: string;
  timestamp: string | null;
  method: string;
  path: string;
  body: Buffer;
  signature: string | null;
  now?: number;
}): boolean {
  const ts = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (!input.secret || !Number.isFinite(ts) || Math.abs(now - ts) > SKEW_MS) return false;
  const expected = signRequest({ secret: input.secret, timestamp: String(ts), method: input.method, path: input.path, body: input.body });
  const actual = Buffer.from(input.signature || "", "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}
