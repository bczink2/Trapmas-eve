import { getStore } from "@/lib/store";
import { handle, json, requestOrigin } from "@/lib/http";
import { ingestPaymentWebhook } from "@/lib/payments/service";
import { parseSquarePaymentEvent, verifySquareSignature } from "@/lib/payments/square";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return handle(async () => {
    const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (!key) return json({ error: "Square webhook key is not set." }, 503);
    const raw = await request.text();
    const notificationUrl =
      process.env.SQUARE_WEBHOOK_URL || `${requestOrigin(request)}/api/webhooks/square`;
    if (!verifySquareSignature(raw, request.headers.get("x-square-hmacsha256-signature"), key, notificationUrl)) {
      return json({ error: "Invalid Square signature." }, 400);
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }
    const payment = parseSquarePaymentEvent(parsedBody);
    if (!payment) return json({ received: true, ignored: true });
    const result = await ingestPaymentWebhook(await getStore(), "square_cashapp", payment);
    return json({ received: true, ...result });
  });
}
