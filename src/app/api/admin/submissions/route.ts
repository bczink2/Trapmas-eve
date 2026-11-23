import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const status = url.searchParams.get("status") || "";
    if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return json({ error: "Unknown status." }, 400);
    }
    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
    const limit = 25;
    const store = await getStore();
    const [list, stats, settings] = await Promise.all([
      store.listSubmissions({ q, status, limit, offset: (page - 1) * limit }),
      store.submissionStats(),
      store.getSettings(),
    ]);
    return json({
      ...list,
      page,
      limit,
      stats,
      applicationsOpen: settings.applicationsOpen,
      feeCents: settings.feeCents,
    });
  });
}
