import { createHmac, timingSafeEqual } from "crypto";

export type StripeCheckoutInput = {
  secretKey?: string;
  submissionId: string;
  publicId: string;
  amountCents: number;
  customerEmail: string;
  eventName: string;
  successUrl: string;
  cancelUrl: string;
};

export function buildStripeCheckoutBody(input: StripeCheckoutInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("customer_email", input.customerEmail);
  params.set("client_reference_id", input.submissionId);
  params.set("metadata[submissionId]", input.submissionId);
  params.set("metadata[publicId]", input.publicId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  params.set(
    "line_items[0][price_data][product_data][name]",
    `${input.eventName} artist submission ${input.publicId}`,
  );
  return params;
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  return signatures.some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
  });
}

export type ParsedProviderPayment = {
  eventId: string;
  submissionId: string;
  amountCents: number | null;
  reference: string;
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

export function parseStripePaymentEvent(raw: unknown): ParsedProviderPayment | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as StripeEvent;
  if (event.type !== "checkout.session.completed" || !event.id) return null;
  const session = event.data?.object;
  if (!session) return null;
  const paymentStatus = session.payment_status;
  if (
    paymentStatus &&
    paymentStatus !== "paid" &&
    paymentStatus !== "no_payment_required"
  ) {
    return null;
  }
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const submissionId = String(metadata.submissionId || session.client_reference_id || "");
  if (!submissionId) return null;
  const amount = session.amount_total;
  const reference = String(session.payment_intent || session.id || event.id);
  return {
    eventId: event.id,
    submissionId,
    amountCents: typeof amount === "number" ? amount : null,
    reference,
  };
}
