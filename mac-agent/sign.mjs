import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SKEW_MS = 5 * 60 * 1000;

export function bodyHash(body) {
  return createHash("sha256").update(body).digest("hex");
}

export function signRequest({ secret, timestamp, method, path, body }) {
  const payload = `${timestamp}\n${String(method).toUpperCase()}\n${path}\n${bodyHash(body)}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyRequest({ secret, timestamp, method, path, body, signature, now = Date.now() }) {
  const ts = Number(timestamp);
  if (!secret || !Number.isFinite(ts) || Math.abs(now - ts) > SKEW_MS) return false;
  const expected = signRequest({ secret, timestamp: String(ts), method, path, body });
  const actual = Buffer.from(String(signature || ""), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}
