import { passwordsMatch } from "@/lib/auth/token";
import { confirmDriveDownload } from "@/lib/drive/archive";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function presentedToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-admin-export-token")?.trim() || "";
}

export function POST(request: Request) {
  return handle(async () => {
    const expected = process.env.ADMIN_EXPORT_TOKEN || "";
    if (!expected) return json({ error: "Set ADMIN_EXPORT_TOKEN before confirming a sync." }, 503);
    const presented = presentedToken(request);
    if (!presented || !passwordsMatch(presented, expected)) {
      return json({ error: "Export token was missing or wrong." }, 401);
    }
    const body = (await request.json().catch(() => null)) as {
      publicId?: string;
      files?: { photo?: string; song1?: string; song2?: string; info?: string };
    } | null;
    if (!body?.publicId) return json({ error: "Send the TRAP id." }, 400);
    const result = await confirmDriveDownload(await getStore(), body.publicId, body.files || {});
    return json(result);
  });
}
