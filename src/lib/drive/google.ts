import { createSign } from "crypto";
import type { DriveClient } from "@/lib/drive/types";

type TokenCache = { token: string; expiresAt: number };
let cached: TokenCache | null = null;

function serviceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) return null;
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
}

export function driveConfigured(): boolean {
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) return false;
  if (serviceAccount()) return true;
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

export async function getGoogleAccessToken(): Promise<string> {
  return accessToken();
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const account = serviceAccount();
  const body = new URLSearchParams();
  if (account) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");
    const unsigned = `${header}.${claim}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
    body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
    body.set("assertion", `${unsigned}.${signature}`);
  } else {
    body.set("grant_type", "refresh_token");
    body.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID || "");
    body.set("client_secret", process.env.GOOGLE_OAUTH_CLIENT_SECRET || "");
    body.set("refresh_token", process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || "Google Drive did not grant a token.");
  }
  cached = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 };
  return payload.access_token;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export function googleDriveClient(): DriveClient {
  return {
    async ensureFolder(parentId, name) {
      const q = encodeURIComponent(
        `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
      );
      const listed = await driveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      );
      const found = (await listed.json()) as { files?: { id: string }[] };
      if (found.files?.[0]?.id) return found.files[0].id;
      const created = await driveFetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      });
      const folder = (await created.json()) as { id?: string; error?: { message?: string } };
      if (!created.ok || !folder.id) throw new Error(folder.error?.message || "Could not create the Drive folder.");
      return folder.id;
    },
    async upload(folderId, name, mime, data) {
      const boundary = `trapmas${Date.now()}`;
      const meta = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n`,
      );
      const head = Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
      const tail = Buffer.from(`\r\n--${boundary}--`);
      const body = Buffer.concat([meta, head, data, tail]);
      const response = await driveFetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
        {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        },
      );
      const payload = (await response.json()) as { id?: string; error?: { message?: string } };
      if (!response.ok || !payload.id) throw new Error(payload.error?.message || "Drive upload failed.");
      return { id: payload.id };
    },
    async download(fileId) {
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      );
      if (!response.ok) throw new Error(`Drive download failed (${response.status}).`);
      return Buffer.from(await response.arrayBuffer());
    },
    async move(fileId, toParent, fromParent, name) {
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${encodeURIComponent(toParent)}&removeParents=${encodeURIComponent(fromParent)}&supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(name ? { name } : {}),
        },
      );
      if (!response.ok) throw new Error(`Drive move failed (${response.status}).`);
    },
    async remove(fileId) {
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
        { method: "DELETE" },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(`Drive delete failed (${response.status}).`);
      }
    },
  };
}

export async function uploadResumable(input: {
  folderId: string;
  name: string;
  mime: string;
  size: number;
  body: ReadableStream<Uint8Array>;
}): Promise<{ id: string; size: number }> {
  const started = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mime,
        "X-Upload-Content-Length": String(input.size),
      },
      body: JSON.stringify({ name: input.name, parents: [input.folderId] }),
    },
  );
  const location = started.headers.get("location");
  if (!started.ok || !location) {
    const detail = await started.text();
    throw new Error(detail.slice(0, 300) || "Google Drive did not start the upload.");
  }
  const uploaded = await fetch(location, {
    method: "PUT",
    headers: {
      "Content-Length": String(input.size),
      "Content-Type": input.mime,
    },
    body: input.body,
    duplex: "half",
  } as RequestInit);
  const payload = (await uploaded.json()) as { id?: string; error?: { message?: string } };
  if (!uploaded.ok || !payload.id) {
    throw new Error(payload.error?.message || "Google Drive upload failed.");
  }
  const meta = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${payload.id}?fields=size&supportsAllDrives=true`,
  );
  const info = (await meta.json()) as { size?: string };
  const size = Number(info.size || 0);
  if (!meta.ok || size !== input.size) {
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${payload.id}?supportsAllDrives=true`, {
      method: "DELETE",
    }).catch(() => undefined);
    throw new Error("Google Drive did not store the full file. Try the upload again.");
  }
  return { id: payload.id, size };
}

export function driveClientFromEnv(): DriveClient | null {
  if (!driveConfigured()) return null;
  return googleDriveClient();
}
