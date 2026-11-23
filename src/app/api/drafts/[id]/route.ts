import { getStore } from "@/lib/store";
import { handle, json, tokenFrom } from "@/lib/http";
import { artistView, paymentInstructions, requireArtist, saveAcks, updateDraft } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export function GET(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    const store = await getStore();
    const submission = await requireArtist(store, id, tokenFrom(request));
    const settings = await store.getSettings();
    return json({
      application: artistView(submission),
      instructions: paymentInstructions(settings, submission),
    });
  });
}

export function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ error: "Send the updated application as JSON." }, 400);
    const store = await getStore();
    let submission = await requireArtist(store, id, tokenFrom(request));
    submission = await updateDraft(store, submission, body);
    if (
      "ackTerms" in body ||
      "ackPrivacy" in body ||
      "ackRefund" in body ||
      "ackRights" in body ||
      "ackPhoto" in body ||
      "ackFee" in body
    ) {
      submission = await saveAcks(store, submission, {
        ackTerms: Boolean(body.ackTerms),
        ackPrivacy: Boolean(body.ackPrivacy),
        ackRefund: Boolean(body.ackRefund),
        ackRights: Boolean(body.ackRights),
        ackPhoto: Boolean(body.ackPhoto),
        ackFee: Boolean(body.ackFee),
      });
    }
    const settings = await store.getSettings();
    return json({
      application: artistView(submission),
      instructions: paymentInstructions(settings, submission),
    });
  });
}
