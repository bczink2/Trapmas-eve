import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { actorName, markPaid } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      amountCents?: number;
      reference?: string;
    } | null;
    const store = await getStore();
    const existing = await store.getSubmission(id);
    if (!existing) return json({ error: "Submission not found." }, 404);
    const settings = await store.getSettings();
    const result = await markPaid(store, id, {
      actor: actorName(settings),
      amountCents: Number.isInteger(body?.amountCents) ? Number(body?.amountCents) : settings.feeCents,
      reference: body?.reference || "",
      provider: existing.paymentProvider || settings.paymentProvider,
    });
    return json(result);
  });
}
