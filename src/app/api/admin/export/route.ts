import { passwordsMatch } from "@/lib/auth/token";
import { buildPaidExport } from "@/lib/export";
import { getStore } from "@/lib/store";
import { handle, json, requestOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function presentedToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-admin-export-token")?.trim() || "";
}

export function GET(request: Request) {
  return handle(async () => {
    const expected = process.env.ADMIN_EXPORT_TOKEN || "";
    if (!expected) {
      return json({ error: "Set ADMIN_EXPORT_TOKEN before using the export." }, 503);
    }
    const presented = presentedToken(request);
    if (!presented || !passwordsMatch(presented, expected)) {
      return json({ error: "Export token was missing or wrong." }, 401);
    }
    const since = new URL(request.url).searchParams.get("since");
    if (since && Number.isNaN(Date.parse(since))) {
      return json({ error: "since must be an ISO date, like 2026-11-01T00:00:00.000Z." }, 400);
    }
    return json(await buildPaidExport(await getStore(), since, requestOrigin(request)));
  });
}
