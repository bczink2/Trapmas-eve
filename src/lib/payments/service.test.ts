import { createHmac } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listEmails, listEvents, updateSettings } from "@/lib/db/repo";
import { openDatabase } from "@/lib/db/index";
import type { Database } from "@/lib/db/sql";
import { sqliteStore, type Store } from "@/lib/store";
import { formatPublicId, noteIncludesPublicId } from "@/lib/ids";
import {
  claimCashAppPayment,
  decideSubmission,
  ingestPaymentWebhook,
  markAwaitingPayment,
  markPaid,
  refundSubmission,
  removeSubmission,
  saveAcks,
  startDraft,
  storeArtistFile,
} from "@/lib/payments/service";
import { buildSquarePaymentLinkBody } from "@/lib/payments/square";
import { verifySquareSignature } from "@/lib/payments/square";
import {
  buildStripeCheckoutBody,
  parseStripePaymentEvent,
  verifyStripeSignature,
} from "@/lib/payments/stripe";
import type { ProfileInput } from "@/lib/profile";

const profile: ProfileInput = {
  artistName: "Night Drive",
  legalName: "Alex Carter",
  email: "alex@example.com",
  phone: "2055550148",
  city: "Greensboro",
  state: "AL",
  instagram: "nightdrive",
  genre: "Trap",
  bio: "Two songs and a photo.",
  organizerNote: "",
  song1Title: "Eve",
  song2Title: "After Midnight",
};

function mp3(): Buffer {
  const bytes = Buffer.alloc(48);
  bytes[0] = 0x49;
  bytes[1] = 0x44;
  bytes[2] = 0x33;
  bytes[3] = 0x04;
  return bytes;
}

function jpeg(): Buffer {
  const bytes = Buffer.alloc(24);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

async function readySubmission(store: Store) {
  const { submission } = await startDraft(store, profile);
  let current = submission;
  current = await storeArtistFile(store, current, "song1", {
    filename: "eve.mp3",
    mime: "audio/mpeg",
    bytes: mp3(),
  });
  current = await storeArtistFile(store, current, "song2", {
    filename: "midnight.mp3",
    mime: "audio/mpeg",
    bytes: mp3(),
  });
  current = await storeArtistFile(store, current, "photo", {
    filename: "press.jpg",
    mime: "image/jpeg",
    bytes: jpeg(),
  });
  current = await saveAcks(store, current, {
    ackTerms: true,
    ackPrivacy: true,
    ackRefund: true,
    ackRights: true,
    ackPhoto: true,
    ackFee: true,
  });
  current = await markAwaitingPayment(store, current);
  return current;
}

describe("submission payments", () => {
  let db: Database;
  let store: Store;
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "trapmas-"));
    process.env.LOCAL_UPLOAD_DIR = uploadDir;
    delete process.env.SUPABASE_URL;
    delete process.env.RESEND_API_KEY;
    db = openDatabase(":memory:");
    store = sqliteStore(db);
    await updateSettings(db, { cashappCashtag: "$TrapmasEve", applicationsOpen: true });
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("issues TRAP-### ids and keeps a draft when payment is abandoned", async () => {
    expect(formatPublicId(1)).toBe("TRAP-001");
    expect(formatPublicId(42)).toBe("TRAP-042");
    const first = await readySubmission(store);
    const second = await startDraft(store, { ...profile, email: "other@example.com", artistName: "Second" });
    expect(first.publicId).toBe("TRAP-001");
    expect(second.submission.publicId).toBe("TRAP-002");
    expect(first.status).toBe("awaiting_payment");
    expect(noteIncludesPublicId("fee for trap-001 thanks", first.publicId)).toBe(true);
    const emails = await listEmails(db, first.id);
    expect(emails.some((email) => email.template === "confirmation")).toBe(false);
  });

  it("stays payment pending until mark paid, then sends one confirmation", async () => {
    const draft = await readySubmission(store);
    await expect(
      claimCashAppPayment(store, draft, { paidFrom: "$fan", paymentNote: "paid the fee" }),
    ).rejects.toThrow(/TRAP-001/);

    const claimed = await claimCashAppPayment(store, draft, {
      paidFrom: "Alex Carter",
      paymentNote: "TRAP-001 submission fee",
    });
    expect(claimed.submission.status).toBe("payment_pending");
    expect(claimed.emailStatus).toBe("logged_dev");
    let emails = await listEmails(db, draft.id);
    expect(emails.map((email) => email.template)).toEqual(["pending"]);

    const paid = await markPaid(store, draft.id, {
      actor: "Barryel Watkins (admin)",
      amountCents: 2500,
      reference: "Cash App note TRAP-001",
    });
    expect(paid.alreadyPaid).toBe(false);
    expect(paid.submission.status).toBe("paid");
    expect(paid.submission.paidBy).toBe("Barryel Watkins (admin)");
    expect(paid.submission.paidAmountCents).toBe(2500);
    expect(paid.submission.paymentReference).toContain("TRAP-001");
    expect(paid.submission.paidAt).not.toBe("");
    expect(paid.emailStatus).toBe("logged_dev");

    const again = await markPaid(store, draft.id, {
      actor: "Barryel Watkins (admin)",
      amountCents: 2500,
      reference: "again",
    });
    expect(again.alreadyPaid).toBe(true);
    expect(again.emailStatus).toBe("not_sent");
    emails = await listEmails(db, draft.id);
    expect(emails.filter((email) => email.template === "confirmation")).toHaveLength(1);

    const history = await listEvents(db, draft.id);
    expect(history.map((event) => event.toStatus)).toContain("payment_pending");
    expect(history.map((event) => event.toStatus)).toContain("paid");
  });

  it("treats a repeated Stripe webhook as one payment", async () => {
    const draft = await readySubmission(store);
    const event = {
      id: "evt_same",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_status: "paid",
          amount_total: 2500,
          payment_intent: "pi_1",
          metadata: { submissionId: draft.id },
          client_reference_id: draft.id,
        },
      },
    };
    const parsed = parseStripePaymentEvent(event);
    expect(parsed?.submissionId).toBe(draft.id);
    const first = await ingestPaymentWebhook(store, "stripe_checkout", parsed!);
    const second = await ingestPaymentWebhook(store, "stripe_checkout", parsed!);
    expect(first.duplicate).toBe(false);
    expect(first.emailStatus).toBe("logged_dev");
    expect(second.duplicate).toBe(true);
    expect(second.emailStatus).toBe("not_sent");
    const emails = await listEmails(db, draft.id);
    expect(emails.filter((email) => email.template === "confirmation")).toHaveLength(1);
  });

  it("blocks new payments when applications are closed", async () => {
    const draft = await readySubmission(store);
    await updateSettings(db, { applicationsOpen: false });
    await expect(
      claimCashAppPayment(store, draft, { paidFrom: "Alex", paymentNote: "TRAP-001" }),
    ).rejects.toThrow(/closed/i);
    await expect(startDraft(store, profile)).rejects.toThrow(/closed/i);
  });

  it("sends a decision only after payment and records a manual refund", async () => {
    const draft = await readySubmission(store);
    await expect(decideSubmission(store, draft, "approved", "See you there", "admin")).rejects.toThrow(/payment/i);
    await claimCashAppPayment(store, draft, { paidFrom: "$alex", paymentNote: "TRAP-001" });
    const pending = (await listEvents(db, draft.id)).at(-1);
    expect(pending?.toStatus).toBe("payment_pending");
    const paid = await markPaid(store, draft.id, {
      actor: "admin",
      amountCents: 2500,
      reference: "manual",
    });
    const decided = await decideSubmission(store, paid.submission, "waitlisted", "Next in line", "admin");
    expect(decided.submission.status).toBe("waitlisted");
    expect(decided.emailStatus).toBe("logged_dev");
    const refunded = await refundSubmission(store, decided.submission, {
      actor: "Barryel Watkins (admin)",
      note: "Returned in Cash App",
    });
    expect(refunded.status).toBe("refunded");
    expect(refunded.refundedBy).toContain("Barryel");
    expect(refunded.refundNote).toMatch(/Cash App/);
  });

  it("deletes the submission and its files", async () => {
    const draft = await readySubmission(store);
    expect(fs.existsSync(path.join(uploadDir, draft.photoKey))).toBe(true);
    await removeSubmission(store, draft);
    expect(fs.existsSync(path.join(uploadDir, draft.photoKey))).toBe(false);
    const { getSubmission } = await import("@/lib/db/repo");
    expect(await getSubmission(db, draft.id)).toBeNull();
  });
});

describe("provider adapters", () => {
  it("builds a Stripe Checkout request and checks the webhook signature", () => {
    const body = buildStripeCheckoutBody({
      submissionId: "sub_1",
      publicId: "TRAP-014",
      amountCents: 2500,
      customerEmail: "alex@example.com",
      eventName: "TRAPMAS EVE 2026",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/back",
    });
    expect(body.get("mode")).toBe("payment");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("2500");
    expect(body.get("metadata[submissionId]")).toBe("sub_1");
    expect(body.get("metadata[publicId]")).toBe("TRAP-014");
    expect(body.get("client_reference_id")).toBe("sub_1");

    const payload = '{"id":"evt_1"}';
    const secret = "whsec_test";
    const timestamp = "1700000000";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyStripeSignature(payload, header, secret, 1_700_000_000_000)).toBe(true);
    expect(verifyStripeSignature(payload, header, "other-secret", 1_700_000_000_000)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=abcd`, secret, 1_700_000_000_000)).toBe(false);
    expect(verifyStripeSignature(payload, header, secret, 1_700_000_000_000 + 400_000)).toBe(false);
  });

  it("builds a Square Cash App Pay link and checks its webhook signature", () => {
    const body = buildSquarePaymentLinkBody({
      submissionId: "sub_9",
      publicId: "TRAP-009",
      amountCents: 2500,
      eventName: "TRAPMAS EVE 2026",
      locationId: "LOC",
      redirectUrl: "https://example.com/back",
      idempotencyKey: "sub_9-checkout",
    });
    const order = body.order as { reference_id: string; line_items: { base_price_money: { amount: number } }[] };
    const checkout = body.checkout_options as { accepted_payment_methods: { cash_app_pay: boolean } };
    expect(order.reference_id).toBe("sub_9");
    expect(order.line_items[0].base_price_money.amount).toBe(2500);
    expect(checkout.accepted_payment_methods.cash_app_pay).toBe(true);

    const payload = "{\"event_id\":\"evt\"}";
    const key = "square-key";
    const url = "https://example.com/api/webhooks/square";
    const signature = createHmac("sha256", key).update(url + payload).digest("base64");
    expect(verifySquareSignature(payload, signature, key, url)).toBe(true);
    expect(verifySquareSignature(payload, signature, key, url + "/wrong")).toBe(false);
  });
});
