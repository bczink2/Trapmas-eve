import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { archivePaidSubmission } from "@/lib/drive/archive";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    if (!submission.paidAt) return json({ error: "Mark the payment before copying to Drive." }, 409);
    const result = await archivePaidSubmission(store, submission);
    return json({ ...result, submission: await store.getSubmission(id) });
  });
}
