import { AppError } from "@/lib/errors";
import { MAC_PAUSED, macLink } from "@/lib/mac/registry";
import { signRequest } from "@/lib/mac/sign";
import type { Submission } from "@/lib/types";

function secret(): string {
  const value = process.env.MAC_RECEIVER_SECRET || "";
  if (!value) throw new AppError(503, "Set MAC_RECEIVER_SECRET on Render and on the Mac.", "not_configured");
  return value;
}

function endpoint(): string {
  const link = macLink();
  if (!link.online || !link.url) throw new AppError(503, MAC_PAUSED, "mac_offline");
  return link.url.replace(/\/$/, "");
}

async function signedFetch(method: string, path: string, body: Buffer, headers: Record<string, string> = {}): Promise<Response> {
  const timestamp = String(Date.now());
  try {
    return await fetch(`${endpoint()}${path}`, {
      method,
      body: method === "GET" ? undefined : new Uint8Array(body),
      headers: {
        "X-Trapmas-Timestamp": timestamp,
        "X-Trapmas-Signature": signRequest({ secret: secret(), timestamp, method, path, body }),
        ...headers,
      },
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AppError(503, MAC_PAUSED, "mac_offline");
  }
}

export async function macRpc<T>(op: string, input: unknown = {}): Promise<T> {
  const response = await signedFetch("POST", "/v1/rpc", Buffer.from(JSON.stringify({ op, input })), { "Content-Type": "application/json" });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; error?: string; code?: string; status?: number } | null;
  if (!response.ok || !payload?.ok) {
    throw new AppError(payload?.status || response.status || 502, payload?.error || MAC_PAUSED, payload?.code || "mac");
  }
  return payload.result as T;
}

export async function macUpload(id: string, kind: string, filename: string, mime: string, bytes: Buffer): Promise<Submission> {
  const response = await signedFetch("POST", "/v1/files", bytes, {
    "Content-Type": mime,
    "X-Submission-Id": id,
    "X-Kind": kind,
    "X-Filename": filename,
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: Submission; error?: string; code?: string; status?: number } | null;
  if (!response.ok || !payload?.ok || !payload.result) {
    throw new AppError(payload?.status || 502, payload?.error || MAC_PAUSED, payload?.code || "mac_upload");
  }
  return payload.result;
}

export async function macDownload(path: string): Promise<{ data: Buffer; contentType: string } | null> {
  const response = await signedFetch("GET", path, Buffer.alloc(0));
  if (response.status === 404) return null;
  if (!response.ok) throw new AppError(502, MAC_PAUSED, "mac");
  return { data: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") || "application/octet-stream" };
}

export async function macSaveBranding(slot: "artwork" | "qr", bytes: Buffer, mime: string) {
  const response = await signedFetch("POST", `/v1/branding/${slot}`, bytes, { "Content-Type": mime });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: unknown; error?: string; status?: number; code?: string } | null;
  if (!response.ok || !payload?.ok) throw new AppError(payload?.status || 502, payload?.error || MAC_PAUSED, payload?.code || "mac");
  return payload.result;
}

export async function macClearBranding(slot: "artwork" | "qr") {
  const response = await signedFetch("DELETE", `/v1/branding/${slot}`, Buffer.alloc(0));
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: unknown; error?: string; status?: number; code?: string } | null;
  if (!response.ok || !payload?.ok) throw new AppError(payload?.status || 502, payload?.error || MAC_PAUSED, payload?.code || "mac");
  return payload.result;
}
