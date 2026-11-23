import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { ingestPaymentWebhook } from "@/lib/payments/service";
import { parseStripePaymentEvent, verifyStripeSignature } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return handle(async () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return json({ error: "Stripe webhook secret is not set." }, 503);
    const raw = await request.text();
    if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
      return json({ error: "Invalid Stripe signature." }, 400);
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }
    const payment = parseStripePaymentEvent(parsedBody);
    if (!payment) return json({ received: true, ignored: true });
    const result = await ingestPaymentWebhook(await getStore(), "stripe_checkout", payment);
    return json({ received: true, ...result });
  });
}
