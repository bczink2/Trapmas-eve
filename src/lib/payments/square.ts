import { createHmac, timingSafeEqual } from "crypto";
import type { ParsedProviderPayment } from "@/lib/payments/stripe";

export type SquareLinkInput = {
  submissionId: string;
  publicId: string;
  amountCents: number;
  eventName: string;
  locationId: string;
  redirectUrl: string;
  idempotencyKey: string;
};

export function buildSquarePaymentLinkBody(input: SquareLinkInput): Record<string, unknown> {
  return {
    idempotency_key: input.idempotencyKey,
    description: `${input.eventName} artist submission ${input.publicId}`,
    order: {
      location_id: input.locationId,
      reference_id: input.submissionId,
      line_items: [
        {
          name: `${input.eventName} submission ${input.publicId}`,
          quantity: "1",
          base_price_money: { amount: input.amountCents, currency: "USD" },
        },
      ],
    },
    checkout_options: {
      redirect_url: input.redirectUrl,
      accepted_payment_methods: {
        apple_pay: false,
        google_pay: false,
        cash_app_pay: true,
        afterpay_clearpay: false,
      },
    },
  };
}

export function verifySquareSignature(
  payload: string,
  header: string | null,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  if (!header || !signatureKey || !notificationUrl) return false;
  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + payload)
    .digest("base64");
  const actual = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
}

export function parseSquarePaymentEvent(raw: unknown): ParsedProviderPayment | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as {
    event_id?: string;
    type?: string;
    data?: { object?: { payment?: Record<string, unknown> } & Record<string, unknown> };
  };
  if (!event.event_id) return null;
  if (event.type !== "payment.updated" && event.type !== "payment.created") return null;
  const payment = (event.data?.object?.payment ?? event.data?.object) as
    | Record<string, unknown>
    | undefined;
  if (!payment || payment.status !== "COMPLETED") return null;
  const submissionId = String(payment.reference_id || "");
  if (!submissionId) return null;
  const money = payment.amount_money as { amount?: number } | undefined;
  return {
    eventId: event.event_id,
    submissionId,
    amountCents: typeof money?.amount === "number" ? money.amount : null,
    reference: String(payment.id || event.event_id),
  };
}
