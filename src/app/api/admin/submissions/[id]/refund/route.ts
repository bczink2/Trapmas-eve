import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { actorName, refundSubmission } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { note?: string; amountCents?: number } | null;
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    const settings = await store.getSettings();
    const updated = await refundSubmission(store, submission, {
      actor: actorName(settings),
      note: body?.note || "Marked refunded after a manual Cash App refund.",
      amountCents: body?.amountCents,
    });
    return json({ submission: updated });
  });
}
