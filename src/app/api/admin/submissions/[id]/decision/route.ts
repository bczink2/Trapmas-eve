import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { actorName, decideSubmission } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DECISIONS = new Set(["approved", "waitlisted", "declined"]);

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      decision?: string;
      message?: string;
    } | null;
    if (!body?.decision || !DECISIONS.has(body.decision)) {
      return json({ error: "Choose approve, waitlist, or decline." }, 400);
    }
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    const settings = await store.getSettings();
    const result = await decideSubmission(
      store,
      submission,
      body.decision as "approved" | "waitlisted" | "declined",
      body.message || "",
      actorName(settings),
    );
    return json(result);
  });
}
