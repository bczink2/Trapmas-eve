import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { cashtagLooksValid, normalizeCashtag } from "@/lib/ids";
import type { PaymentProviderId, Settings } from "@/lib/types";
import { PAYMENT_PROVIDERS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEXT_FIELDS: (keyof Settings)[] = [
  "eventName",
  "eventTagline",
  "eventSubheading",
  "eventDescription",
  "presenterName",
  "featuredArtist",
  "eventDate",
  "eventTime",
  "venueName",
  "venueAddress",
  "city",
  "submissionDeadline",
  "contactEmail",
  "contactPhone",
  "instagramUrl",
  "emailFromName",
  "emailReplyTo",
  "termsText",
  "privacyText",
  "refundText",
  "pendingEmailSubject",
  "pendingEmailBody",
  "confirmationEmailSubject",
  "confirmationEmailBody",
  "approvedEmailSubject",
  "approvedEmailBody",
  "waitlistEmailSubject",
  "waitlistEmailBody",
  "declinedEmailSubject",
  "declinedEmailBody",
];

export function GET() {
  return handle(async () => {
    await requireAdmin();
    return json(await (await getStore()).getSettings());
  });
}

export function PUT(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ error: "Send the settings as JSON." }, 400);
    const patch: Partial<Settings> = {};
    for (const field of TEXT_FIELDS) {
      if (typeof body[field] === "string") {
        (patch as Record<string, string>)[field] = body[field].slice(0, 20000);
      }
    }
    if ("applicationsOpen" in body) patch.applicationsOpen = Boolean(body.applicationsOpen);
    if ("legalIsDraft" in body) patch.legalIsDraft = Boolean(body.legalIsDraft);
    if ("feeCents" in body) {
      const fee = Number(body.feeCents);
      if (!Number.isInteger(fee) || fee < 0 || fee > 100000) {
        return json({ error: "The fee must be a whole number of cents, up to $1,000." }, 400);
      }
      patch.feeCents = fee;
    }
    if ("paymentProvider" in body) {
      const provider = String(body.paymentProvider || "");
      if (!PAYMENT_PROVIDERS.includes(provider as PaymentProviderId)) {
        return json({ error: "Unknown payment provider." }, 400);
      }
      patch.paymentProvider = provider as PaymentProviderId;
    }
    if ("cashappCashtag" in body) {
      const cashtag = normalizeCashtag(String(body.cashappCashtag || ""));
      if (cashtag && !cashtagLooksValid(cashtag)) {
        return json({ error: "Enter a Cash App $Cashtag like $TrapmasEve, or leave it blank." }, 400);
      }
      patch.cashappCashtag = cashtag;
    }
    if (Array.isArray(body.genreOptions)) {
      patch.genreOptions = body.genreOptions.map((genre) => String(genre).trim()).filter(Boolean).slice(0, 20);
    } else if (typeof body.genreOptions === "string") {
      patch.genreOptions = body.genreOptions
        .split(/\n|,/)
        .map((genre) => genre.trim())
        .filter(Boolean)
        .slice(0, 20);
    }
    return json(await (await getStore()).updateSettings(patch));
  });
}
