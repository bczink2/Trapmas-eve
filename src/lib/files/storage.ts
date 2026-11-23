import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import path from "path";

export type StoredFile = {
  data: Buffer;
  contentType: string;
};

export type MediaAccess = {
  key: string;
  driveId: string;
};

function rootDir(): string {
  return process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

export function storageMode(): "disk" {
  return "disk";
}

function assertKey(key: string): void {
  if (!key || !/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..") || key.startsWith("/")) {
    throw new Error("Unsafe storage key.");
  }
}

function localPath(key: string): string {
  assertKey(key);
  const full = path.resolve(rootDir(), key);
  const root = path.resolve(rootDir());
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error("Storage key escapes the upload directory.");
  }
  return full;
}

export async function putObject(key: string, data: Buffer, contentType: string): Promise<void> {
  const full = localPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  await fs.writeFile(`${full}.type`, contentType);
}

export async function getObject(key: string): Promise<StoredFile | null> {
  if (!key) return null;
  try {
    const full = localPath(key);
    const data = await fs.readFile(full);
    let contentType = "application/octet-stream";
    try {
      contentType = (await fs.readFile(`${full}.type`, "utf8")).trim() || contentType;
    } catch {
      // type sidecar is optional
    }
    return { data, contentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!key) return;
  const full = localPath(key);
  await fs.rm(full, { force: true });
  await fs.rm(`${full}.type`, { force: true });
}

function signingSecret(): string {
  return process.env.MEDIA_SIGNING_SECRET || process.env.ADMIN_SESSION_SECRET || "dev-only-media-secret";
}

export function signMediaAccess(access: Partial<MediaAccess>, ttlSeconds = 900, nowMs = Date.now()): string {
  if (access.key) assertKey(access.key);
  const payload = Buffer.from(
    JSON.stringify({ k: access.key || "", d: access.driveId || "", e: nowMs + ttlSeconds * 1000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function signMediaToken(key: string, ttlSeconds = 900, nowMs = Date.now()): string {
  return signMediaAccess({ key }, ttlSeconds, nowMs);
}

export function verifyMediaToken(token: string, nowMs = Date.now()): MediaAccess | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      k?: string;
      d?: string;
      e?: number;
    };
    if (!parsed.e || parsed.e < nowMs) return null;
    if (parsed.k) assertKey(parsed.k);
    if (!parsed.k && !parsed.d) return null;
    return { key: parsed.k || "", driveId: parsed.d || "" };
  } catch {
    return null;
  }
}

export async function signedReadUrl(key: string, ttlSeconds = 900): Promise<string> {
  return `/api/media/${signMediaToken(key, ttlSeconds)}`;
}

export function signedMediaPath(access: Partial<MediaAccess>, ttlSeconds = 900): string {
  return `/api/media/${signMediaAccess(access, ttlSeconds)}`;
}
