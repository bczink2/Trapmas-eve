import { getStore } from "@/lib/store";
import { handle, json, tokenFrom } from "@/lib/http";
import { artistView, markAwaitingPayment, paymentInstructions, requireArtist } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params;
    const store = await getStore();
    const submission = await requireArtist(store, id, tokenFrom(request));
    const ready = await markAwaitingPayment(store, submission);
    const settings = await store.getSettings();
    return json({
      application: artistView(ready),
      instructions: paymentInstructions(settings, ready),
    });
  });
}
