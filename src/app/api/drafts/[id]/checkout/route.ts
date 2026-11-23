import { getStore } from "@/lib/store";
import { handle, json, requestOrigin, tokenFrom } from "@/lib/http";
import { requireArtist, startHostedCheckout } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params;
    const token = tokenFrom(request);
    const store = await getStore();
    const submission = await requireArtist(store, id, token);
    const checkout = await startHostedCheckout(store, submission, requestOrigin(request), token);
    return json(checkout);
  });
}
