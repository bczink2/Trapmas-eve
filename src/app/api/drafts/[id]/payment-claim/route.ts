import { getStore } from "@/lib/store";
import { handle, json, tokenFrom } from "@/lib/http";
import { artistView, claimCashAppPayment, paymentInstructions, requireArtist } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { paidFrom?: string; paymentNote?: string } | null;
    const store = await getStore();
    const submission = await requireArtist(store, id, tokenFrom(request));
    const claimed = await claimCashAppPayment(store, submission, {
      paidFrom: body?.paidFrom || "",
      paymentNote: body?.paymentNote || "",
    });
    const settings = await store.getSettings();
    return json({
      application: artistView(claimed.submission),
      instructions: paymentInstructions(settings, claimed.submission),
      emailStatus: claimed.emailStatus,
    });
  });
}
