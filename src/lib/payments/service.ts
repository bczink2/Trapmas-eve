import { fileKeys } from "@/lib/db/repo";
import { sendTemplateEmail } from "@/lib/email/send";
import { AppError } from "@/lib/errors";
import { deleteObject, putObject } from "@/lib/files/storage";
import { safeFilename, validateUpload } from "@/lib/files/validate";
import { cashtagLooksValid, normalizeCashtag, noteIncludesPublicId } from "@/lib/ids";
import { parseProfile, profileReadyForPayment, type ProfileInput } from "@/lib/profile";
import { buildSquarePaymentLinkBody } from "@/lib/payments/square";
import { buildStripeCheckoutBody, type ParsedProviderPayment } from "@/lib/payments/stripe";
import { macLink } from "@/lib/mac/registry";
import { usesMacStorage, type Store } from "@/lib/store";
import type { FileKind, PaymentProviderId, PublicSettings, Settings, Submission, SubmissionStatus } from "@/lib/types";

const ARTIST_EDITABLE: SubmissionStatus[] = ["draft", "awaiting_payment"];
const PAYABLE: SubmissionStatus[] = ["draft", "awaiting_payment"];
const DECIDABLE: SubmissionStatus[] = ["paid", "approved", "waitlisted", "declined"];
const REFUNDABLE: SubmissionStatus[] = [
  "payment_pending",
  "paid",
  "approved",
  "waitlisted",
  "declined",
];

export function toPublicSettings(settings: Settings): PublicSettings {
  return {
    eventName: settings.eventName,
    eventTagline: settings.eventTagline,
    eventSubheading: settings.eventSubheading,
    eventDescription: settings.eventDescription,
    featuredArtist: settings.featuredArtist,
    eventDate: settings.eventDate,
    eventTime: settings.eventTime,
    venueName: settings.venueName,
    venueAddress: settings.venueAddress,
    city: settings.city,
    feeCents: settings.feeCents,
    applicationsOpen: settings.applicationsOpen,
    submissionDeadline: settings.submissionDeadline,
    cashappCashtag: settings.cashappCashtag,
    cashappQrReady: Boolean(settings.cashappQrKey),
    artworkUrl: settings.artworkKey ? "/api/branding/artwork" : "/artwork/trapmas-eve-flyer.webp",
    artworkIsDefault: !settings.artworkKey,
    paymentProvider: settings.paymentProvider,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    instagramUrl: settings.instagramUrl,
    genreOptions: settings.genreOptions,
    legalIsDraft: settings.legalIsDraft,
    macOnline: usesMacStorage() ? macLink().online : true,
  };
}

function assertOpen(settings: Settings): void {
  if (!settings.applicationsOpen) {
    throw new AppError(
      403,
      "Submissions are closed. Our team is not taking new payments right now.",
      "closed",
    );
  }
}

export function paymentInstructions(settings: Settings, submission: Submission) {
  return {
    provider: settings.paymentProvider,
    amountCents: settings.feeCents,
    publicId: submission.publicId,
    cashtag: settings.cashappCashtag,
    cashtagReady: cashtagLooksValid(settings.cashappCashtag),
    qrReady: Boolean(settings.cashappQrKey),
    noteHint: submission.publicId,
  };
}

export async function startDraft(store: Store, raw: Partial<ProfileInput>) {
  const settings = await store.getSettings();
  assertOpen(settings);
  const parsed = parseProfile(raw);
  if (!parsed.ok) throw new AppError(400, parsed.error, "invalid");
  return store.createSubmission(parsed.value);
}

export async function updateDraft(store: Store, submission: Submission, raw: Partial<ProfileInput>) {
  if (!ARTIST_EDITABLE.includes(submission.status)) {
    throw new AppError(409, "This application can no longer be edited.", "locked");
  }
  const parsed = parseProfile({
    artistName: raw.artistName ?? submission.artistName,
    legalName: raw.legalName ?? submission.legalName,
    email: raw.email ?? submission.email,
    phone: raw.phone ?? submission.phone,
    city: raw.city ?? submission.city,
    state: raw.state ?? submission.state,
    instagram: raw.instagram ?? submission.instagram,
    genre: raw.genre ?? submission.genre,
    bio: raw.bio ?? submission.bio,
    organizerNote: raw.organizerNote ?? submission.organizerNote,
    song1Title: raw.song1Title ?? submission.song1Title,
    song2Title: raw.song2Title ?? submission.song2Title,
  });
  if (!parsed.ok) throw new AppError(400, parsed.error, "invalid");
  return store.saveProfile(submission.id, parsed.value);
}

export async function storeArtistFile(
  store: Store,
  submission: Submission,
  kind: FileKind,
  file: { filename: string; mime: string; bytes: Buffer },
): Promise<Submission> {
  if (!ARTIST_EDITABLE.includes(submission.status)) {
    throw new AppError(409, "Files can no longer be replaced.", "locked");
  }
  const checked = validateUpload({
    kind,
    filename: file.filename,
    mime: file.mime,
    bytes: file.bytes,
  });
  if (!checked.ok) throw new AppError(400, checked.error, "invalid_file");
  const key = `submissions/${submission.id}/${kind}${checked.extension}`;
  await putObject(key, file.bytes, checked.mime);
  const previous = fileKey(submission, kind);
  if (previous && previous !== key) await deleteObject(previous).catch(() => undefined);
  return store.recordUpload(submission.id, kind, {
    key,
    name: safeFilename(file.filename),
    bytes: file.bytes.byteLength,
  });
}

function fileKey(submission: Submission, kind: FileKind): string {
  if (kind === "photo") return submission.photoKey;
  if (kind === "song1") return submission.song1Key;
  return submission.song2Key;
}

export async function saveAcks(
  store: Store,
  submission: Submission,
  acks: {
    ackTerms: boolean;
    ackPrivacy: boolean;
    ackRefund: boolean;
    ackRights: boolean;
    ackPhoto: boolean;
    ackFee: boolean;
  },
) {
  if (!ARTIST_EDITABLE.includes(submission.status)) {
    throw new AppError(409, "Acknowledgments can no longer be changed.", "locked");
  }
  return store.saveAcknowledgments(submission.id, acks);
}

function missingPieces(submission: Submission): string | null {
  const profileError = profileReadyForPayment({
    artistName: submission.artistName,
    legalName: submission.legalName,
    email: submission.email,
    phone: submission.phone,
    city: submission.city,
    state: submission.state,
    instagram: submission.instagram,
    genre: submission.genre,
    bio: submission.bio,
    organizerNote: submission.organizerNote,
    song1Title: submission.song1Title,
    song2Title: submission.song2Title,
  });
  if (profileError) return profileError;
  if (!(submission.song1Key || submission.song1DriveId) || !(submission.song2Key || submission.song2DriveId)) {
    return "Upload both MP3s before payment.";
  }
  if (!(submission.photoKey || submission.photoDriveId)) return "Upload your photo before payment.";
  if (
    !submission.ackTerms ||
    !submission.ackPrivacy ||
    !submission.ackRefund ||
    !submission.ackRights ||
    !submission.ackPhoto ||
    !submission.ackFee
  ) {
    return "Accept every acknowledgment before payment.";
  }
  return null;
}

export async function markAwaitingPayment(store: Store, submission: Submission) {
  const settings = await store.getSettings();
  assertOpen(settings);
  if (submission.status === "awaiting_payment") return submission;
  if (submission.status !== "draft") {
    throw new AppError(409, "This application is already past the payment step.", "locked");
  }
  const missing = missingPieces(submission);
  if (missing) throw new AppError(400, missing, "incomplete");
  return store.setStatus(submission.id, "awaiting_payment", null, {
    fromStatus: submission.status,
    actor: "artist",
    note: "Reached payment step. Draft kept until payment is claimed.",
  });
}

export async function claimCashAppPayment(
  store: Store,
  submission: Submission,
  input: { paidFrom: string; paymentNote: string },
): Promise<{ submission: Submission; emailStatus: string }> {
  const settings = await store.getSettings();
  assertOpen(settings);
  if (settings.paymentProvider !== "cashapp_manual") {
    throw new AppError(409, "Cash App manual claims are off. Use the checkout button.", "wrong_provider");
  }
  if (!cashtagLooksValid(settings.cashappCashtag)) {
    throw new AppError(
      409,
      "Our team has not published a Cash App $Cashtag yet, so this fee cannot be paid.",
      "cashtag_missing",
    );
  }
  if (submission.status === "payment_pending") {
    return { submission, emailStatus: "already_pending" };
  }
  if (!PAYABLE.includes(submission.status)) {
    throw new AppError(409, "Payment was already recorded for this application.", "locked");
  }
  if (submission.status === "draft") {
    submission = await markAwaitingPayment(store, submission);
  }
  const missing = missingPieces(submission);
  if (missing) throw new AppError(400, missing, "incomplete");
  const paidFrom = input.paidFrom.trim().replace(/\s+/g, " ").slice(0, 80);
  const paymentNote = input.paymentNote.trim().slice(0, 240);
  if (paidFrom.length < 2) {
    throw new AppError(400, "Enter the name or $Cashtag you paid from.", "invalid");
  }
  if (!noteIncludesPublicId(paymentNote, submission.publicId)) {
    throw new AppError(
      400,
      `The Cash App note has to include ${submission.publicId}.`,
      "note_missing_id",
    );
  }
  const payerCashtag = paidFrom.includes("$") ? normalizeCashtag(paidFrom) : "";
  const updated = await store.setStatus(
    submission.id,
    "payment_pending",
    {
      payerName: paidFrom,
      payerCashtag,
      paymentNote,
      paymentClaimedAt: new Date().toISOString(),
      paymentProvider: "cashapp_manual",
    },
    {
      fromStatus: submission.status,
      actor: "artist",
      note: `Payment claimed from ${paidFrom}`,
    },
  );
  const email = await sendTemplateEmail(store, {
    settings,
    submission: updated,
    template: "pending",
  });
  if (email.status === "sent" || email.status === "logged_dev") {
    await store.patch(updated.id, { pendingEmailSentAt: new Date().toISOString() });
  }
  const fresh = await store.getSubmission(updated.id);
  return { submission: fresh ?? updated, emailStatus: email.status };
}

export type MarkPaidInput = {
  actor: string;
  amountCents: number;
  reference: string;
  provider?: string;
  providerSessionId?: string;
};

export async function markPaid(
  store: Store,
  submissionId: string,
  input: MarkPaidInput,
): Promise<{ submission: Submission; alreadyPaid: boolean; emailStatus: string; driveStatus?: string }> {
  const outcome = await store.transaction(async () => {
    const current = await store.getSubmission(submissionId);
    if (!current) throw new AppError(404, "Submission not found.", "not_found");
    if (current.status === "refunded" || current.refundedAt) {
      throw new AppError(409, "This submission is refunded.", "refunded");
    }
    if (current.paidAt) {
      return { submission: current, alreadyPaid: true as const };
    }
    if (!input.reference.trim()) {
      throw new AppError(400, "Enter the Cash App reference or note you matched.", "invalid");
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0 || input.amountCents > 100000) {
      throw new AppError(400, "Enter the amount received in cents.", "invalid");
    }
    const nextStatus: SubmissionStatus = ["draft", "awaiting_payment", "payment_pending"].includes(
      current.status,
    )
      ? "paid"
      : current.status;
    const paidAt = new Date().toISOString();
    const paidPatch: Partial<Submission> = {
      paidAt,
      paidBy: input.actor,
      paidAmountCents: input.amountCents,
      paymentReference: input.reference.trim().slice(0, 160),
      paymentProvider: input.provider || current.paymentProvider || "cashapp_manual",
      providerSessionId: input.providerSessionId || "",
    };
    const submission =
      nextStatus === current.status
        ? await store.patch(current.id, paidPatch)
        : await store.setStatus(current.id, "paid", paidPatch, {
            fromStatus: current.status,
            actor: input.actor,
            note: `Marked paid ${input.amountCents} cents, reference ${input.reference.trim()}`,
          });
    return { submission, alreadyPaid: false as const };
  });

  if (outcome.alreadyPaid || outcome.submission.confirmationEmailSentAt) {
    return { ...outcome, emailStatus: "not_sent" };
  }
  const settings = await store.getSettings();
  const email = await sendTemplateEmail(store, {
    settings,
    submission: outcome.submission,
    template: "confirmation",
  });
  if (email.status === "sent" || email.status === "logged_dev") {
    await store.patch(outcome.submission.id, { confirmationEmailSentAt: new Date().toISOString() });
  }
  const fresh = (await store.getSubmission(outcome.submission.id)) ?? outcome.submission;
  let driveStatus = store.kind === "mac" ? "mac" : "skipped_unconfigured";
  if (store.kind !== "mac") {
    try {
      const { archivePaidSubmission } = await import("@/lib/drive/archive");
      driveStatus = (await archivePaidSubmission(store, fresh)).status;
    } catch (error) {
      console.error(error);
      driveStatus = "failed";
    }
  }
  const afterDrive = (await store.getSubmission(fresh.id)) ?? fresh;
  return {
    submission: afterDrive,
    alreadyPaid: false,
    emailStatus: email.status,
    driveStatus,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "23505" || /UNIQUE constraint/i.test(message) || /duplicate key/i.test(message);
}

export async function ingestPaymentWebhook(
  store: Store,
  provider: PaymentProviderId,
  payment: ParsedProviderPayment,
): Promise<{ duplicate: boolean; emailStatus: string; submissionId: string }> {
  const existing = await store.findWebhook(provider, payment.eventId);
  if (existing) {
    return { duplicate: true, emailStatus: "not_sent", submissionId: existing.submissionId };
  }
  const current = await store.getSubmission(payment.submissionId);
  if (!current) {
    try {
      await store.insertWebhook({
        provider,
        eventId: payment.eventId,
        submissionId: payment.submissionId,
        result: "missing_submission",
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return { duplicate: false, emailStatus: "not_sent", submissionId: payment.submissionId };
  }
  const settings = await store.getSettings();
  const marked = await markPaid(store, payment.submissionId, {
    actor: provider,
    amountCents: payment.amountCents ?? settings.feeCents,
    reference: payment.reference,
    provider,
    providerSessionId: payment.reference,
  });
  try {
    await store.insertWebhook({
      provider,
      eventId: payment.eventId,
      submissionId: payment.submissionId,
      result: marked.alreadyPaid ? "duplicate_payment" : "applied",
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { duplicate: true, emailStatus: marked.emailStatus, submissionId: payment.submissionId };
  }
  return {
    duplicate: marked.alreadyPaid,
    emailStatus: marked.emailStatus,
    submissionId: payment.submissionId,
  };
}

const DECISION_TEMPLATE = {
  approved: "approved",
  waitlisted: "waitlist",
  declined: "declined",
} as const;

export async function decideSubmission(
  store: Store,
  submission: Submission,
  decision: "approved" | "waitlisted" | "declined",
  artistMessage: string,
  actor: string,
) {
  if (!DECIDABLE.includes(submission.status)) {
    throw new AppError(
      409,
      "Mark the payment received before sending a decision.",
      "not_paid",
    );
  }
  const updated =
    submission.status === decision
      ? submission
      : await store.setStatus(submission.id, decision, null, {
          fromStatus: submission.status,
          actor,
          note: artistMessage.trim().slice(0, 1000) || `Decision: ${decision}`,
        });
  const settings = await store.getSettings();
  const email = await sendTemplateEmail(store, {
    settings,
    submission: updated,
    template: DECISION_TEMPLATE[decision],
    note: artistMessage,
  });
  if (email.status === "sent" || email.status === "logged_dev") {
    await store.patch(updated.id, { decisionEmailSentAt: new Date().toISOString() });
  }
  const fresh = await store.getSubmission(updated.id);
  return { submission: fresh ?? updated, emailStatus: email.status };
}

export async function refundSubmission(
  store: Store,
  submission: Submission,
  input: { actor: string; note: string; amountCents?: number },
) {
  if (submission.status === "refunded") {
    return submission;
  }
  if (!REFUNDABLE.includes(submission.status)) {
    throw new AppError(409, "There is no payment to mark refunded.", "not_paid");
  }
  const now = new Date().toISOString();
  const amount =
    input.amountCents && input.amountCents > 0 ? input.amountCents : submission.paidAmountCents;
  return store.setStatus(
    submission.id,
    "refunded",
    {
      refundedAt: now,
      refundedBy: input.actor,
      refundNote: input.note.trim().slice(0, 500),
      paidAmountCents: submission.paidAmountCents || amount,
      paidAt: submission.paidAt || now,
      paidBy: submission.paidBy || input.actor,
    },
    {
      fromStatus: submission.status,
      actor: input.actor,
      note: input.note.trim() || "Marked refunded. Money is returned manually in Cash App.",
    },
  );
}

export async function removeSubmission(store: Store, submission: Submission): Promise<void> {
  for (const key of fileKeys(submission)) {
    await deleteObject(key).catch(() => undefined);
  }
  await store.deleteSubmission(submission.id);
}

export async function startHostedCheckout(
  store: Store,
  submission: Submission,
  origin: string,
  resumeToken = "",
): Promise<{ url: string }> {
  const settings = await store.getSettings();
  assertOpen(settings);
  if (submission.status === "draft") {
    submission = await markAwaitingPayment(store, submission);
  }
  if (!PAYABLE.includes(submission.status) && submission.status !== "awaiting_payment") {
    throw new AppError(409, "This application is not waiting for checkout.", "locked");
  }
  const missing = missingPieces(submission);
  if (missing) throw new AppError(400, missing, "incomplete");

  if (settings.paymentProvider === "stripe_checkout") {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new AppError(503, "Stripe is not configured.", "not_configured");
    const body = buildStripeCheckoutBody({
      submissionId: submission.id,
      publicId: submission.publicId,
      amountCents: settings.feeCents,
      customerEmail: submission.email,
      eventName: settings.eventName,
      successUrl: `${origin}/confirmation/${submission.publicId}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/apply/resume/${resumeToken}`,
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = (await response.json()) as { url?: string; error?: { message?: string } };
    if (!response.ok || !payload.url) {
      throw new AppError(502, payload.error?.message || "Stripe did not start checkout.", "stripe");
    }
    await store.patch(submission.id, { providerSessionId: "stripe_pending", paymentProvider: "stripe_checkout" });
    return { url: payload.url };
  }

  if (settings.paymentProvider === "square_cashapp") {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!token || !locationId) {
      throw new AppError(503, "Square Cash App Pay is not configured.", "not_configured");
    }
    const squareBody = buildSquarePaymentLinkBody({
      submissionId: submission.id,
      publicId: submission.publicId,
      amountCents: settings.feeCents,
      eventName: settings.eventName,
      locationId,
      redirectUrl: `${origin}/confirmation/${submission.publicId}?provider=square`,
      idempotencyKey: `${submission.id}-checkout`,
    });
    const response = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(squareBody),
    });
    const payload = (await response.json()) as {
      payment_link?: { url?: string; id?: string };
      errors?: { detail?: string }[];
    };
    if (!response.ok || !payload.payment_link?.url) {
      throw new AppError(
        502,
        payload.errors?.[0]?.detail || "Square did not start Cash App Pay.",
        "square",
      );
    }
    await store.patch(submission.id, {
      providerSessionId: payload.payment_link.id || "square_pending",
      paymentProvider: "square_cashapp",
    });
    return { url: payload.payment_link.url };
  }

  throw new AppError(409, "The active payment method is Cash App, paid directly to our team.", "wrong_provider");
}

export function actorName(settings: Settings): string {
  return `${settings.presenterName || "Admin"} (admin)`;
}

export async function requireArtist(store: Store, id: string, token: string): Promise<Submission> {
  if (!token) throw new AppError(404, "Application not found.", "not_found");
  const submission = await store.getByResumeToken(token);
  if (!submission || submission.id !== id) {
    throw new AppError(404, "Application not found.", "not_found");
  }
  return submission;
}

export function artistView(submission: Submission) {
  return {
    id: submission.id,
    publicId: submission.publicId,
    status: submission.status,
    artistName: submission.artistName,
    legalName: submission.legalName,
    email: submission.email,
    phone: submission.phone,
    city: submission.city,
    state: submission.state,
    instagram: submission.instagram,
    genre: submission.genre,
    bio: submission.bio,
    organizerNote: submission.organizerNote,
    song1Title: submission.song1Title,
    song2Title: submission.song2Title,
    files: {
      photo:
        submission.photoKey || submission.photoDriveId
          ? { name: submission.photoName, bytes: submission.photoBytes }
          : null,
      song1:
        submission.song1Key || submission.song1DriveId
          ? { name: submission.song1Name, bytes: submission.song1Bytes }
          : null,
      song2:
        submission.song2Key || submission.song2DriveId
          ? { name: submission.song2Name, bytes: submission.song2Bytes }
          : null,
    },
    payerName: submission.payerName,
    paymentNote: submission.paymentNote,
    paymentClaimedAt: submission.paymentClaimedAt,
    paidAt: submission.paidAt,
  };
}
