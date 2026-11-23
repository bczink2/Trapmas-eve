import { randomUUID } from "crypto";
import { defaultSettings } from "@/lib/defaults";
import { formatPublicId, hashToken, randomToken } from "@/lib/ids";
import type { ProfileInput } from "@/lib/profile";
import type {
  EmailTemplateName,
  FileKind,
  PaymentProviderId,
  Settings,
  StatusEvent,
  Submission,
  SubmissionNote,
  SubmissionStatus,
} from "@/lib/types";
import { PAYMENT_PROVIDERS } from "@/lib/types";
import { SCHEMA_SQL } from "@/lib/db/schema";
import type { Database, Row } from "@/lib/db/sql";

const ready = new WeakSet<Database>();

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bit(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function genresToText(genres: string[]): string {
  return genres.map((genre) => genre.trim()).filter(Boolean).join("\n");
}

function textToGenres(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function mapSettings(row: Row): Settings {
  const provider = str(row.payment_provider);
  const paymentProvider: PaymentProviderId = PAYMENT_PROVIDERS.includes(provider as PaymentProviderId)
    ? (provider as PaymentProviderId)
    : "cashapp_manual";
  return {
    eventName: str(row.event_name),
    eventTagline: str(row.event_tagline),
    eventSubheading: str(row.event_subheading),
    eventDescription: str(row.event_description),
    presenterName: str(row.presenter_name),
    featuredArtist: str(row.featured_artist),
    eventDate: str(row.event_date),
    eventTime: str(row.event_time),
    venueName: str(row.venue_name),
    venueAddress: str(row.venue_address),
    city: str(row.city),
    feeCents: num(row.fee_cents),
    applicationsOpen: bit(row.applications_open),
    submissionDeadline: str(row.submission_deadline),
    cashappCashtag: str(row.cashapp_cashtag),
    cashappQrKey: str(row.cashapp_qr_key),
    artworkKey: str(row.artwork_key),
    paymentProvider,
    contactEmail: str(row.contact_email),
    contactPhone: str(row.contact_phone),
    instagramUrl: str(row.instagram_url),
    genreOptions: textToGenres(str(row.genre_options)),
    emailFromName: str(row.email_from_name),
    emailReplyTo: str(row.email_reply_to),
    termsText: str(row.terms_text),
    privacyText: str(row.privacy_text),
    refundText: str(row.refund_text),
    legalIsDraft: bit(row.legal_is_draft),
    pendingEmailSubject: str(row.pending_email_subject),
    pendingEmailBody: str(row.pending_email_body),
    confirmationEmailSubject: str(row.confirmation_email_subject),
    confirmationEmailBody: str(row.confirmation_email_body),
    approvedEmailSubject: str(row.approved_email_subject),
    approvedEmailBody: str(row.approved_email_body),
    waitlistEmailSubject: str(row.waitlist_email_subject),
    waitlistEmailBody: str(row.waitlist_email_body),
    declinedEmailSubject: str(row.declined_email_subject),
    declinedEmailBody: str(row.declined_email_body),
    updatedAt: str(row.updated_at),
  };
}

function mapSubmission(row: Row): Submission {
  return {
    id: str(row.id),
    publicId: str(row.public_id),
    resumeHash: str(row.resume_hash),
    status: str(row.status) as SubmissionStatus,
    artistName: str(row.artist_name),
    legalName: str(row.legal_name),
    email: str(row.email),
    phone: str(row.phone),
    city: str(row.city),
    state: str(row.state),
    instagram: str(row.instagram),
    genre: str(row.genre),
    bio: str(row.bio),
    organizerNote: str(row.organizer_note),
    song1Title: str(row.song1_title),
    song2Title: str(row.song2_title),
    photoKey: str(row.photo_key),
    photoName: str(row.photo_name),
    photoBytes: num(row.photo_bytes),
    song1Key: str(row.song1_key),
    song1Name: str(row.song1_name),
    song1Bytes: num(row.song1_bytes),
    song2Key: str(row.song2_key),
    song2Name: str(row.song2_name),
    song2Bytes: num(row.song2_bytes),
    ackTerms: bit(row.ack_terms),
    ackPrivacy: bit(row.ack_privacy),
    ackRefund: bit(row.ack_refund),
    ackRights: bit(row.ack_rights),
    ackPhoto: bit(row.ack_photo),
    ackFee: bit(row.ack_fee),
    ackedAt: str(row.acked_at),
    paymentProvider: str(row.payment_provider),
    payerName: str(row.payer_name),
    payerCashtag: str(row.payer_cashtag),
    paymentNote: str(row.payment_note),
    paymentClaimedAt: str(row.payment_claimed_at),
    paidAt: str(row.paid_at),
    paidBy: str(row.paid_by),
    paidAmountCents: num(row.paid_amount_cents),
    paymentReference: str(row.payment_reference),
    providerSessionId: str(row.provider_session_id),
    refundedAt: str(row.refunded_at),
    refundedBy: str(row.refunded_by),
    refundNote: str(row.refund_note),
    decisionEmailSentAt: str(row.decision_email_sent_at),
    confirmationEmailSentAt: str(row.confirmation_email_sent_at),
    pendingEmailSentAt: str(row.pending_email_sent_at),
    fileHold: (str(row.file_hold) || "disk") as Submission["fileHold"],
    driveFolderId: str(row.drive_folder_id),
    photoDriveId: str(row.photo_drive_id),
    song1DriveId: str(row.song1_drive_id),
    song2DriveId: str(row.song2_drive_id),
    infoDriveId: str(row.info_drive_id),
    photoSha256: str(row.photo_sha256),
    song1Sha256: str(row.song1_sha256),
    song2Sha256: str(row.song2_sha256),
    infoSha256: str(row.info_sha256),
    syncedAt: str(row.synced_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

async function insertSettings(db: Database, settings: Settings): Promise<void> {
  await db.run(
    `INSERT INTO settings (
      id, event_name, event_tagline, event_subheading, event_description, presenter_name, featured_artist, event_date, event_time,
      venue_name, venue_address, city, fee_cents, applications_open, submission_deadline,
      cashapp_cashtag, cashapp_qr_key, artwork_key, payment_provider, contact_email, contact_phone,
      instagram_url, genre_options, email_from_name, email_reply_to, terms_text, privacy_text,
      refund_text, legal_is_draft, pending_email_subject, pending_email_body,
      confirmation_email_subject, confirmation_email_body, approved_email_subject,
      approved_email_body, waitlist_email_subject, waitlist_email_body, declined_email_subject,
      declined_email_body, updated_at
    ) VALUES (${Array(40).fill("?").join(", ")})`,
    [
      1,
      settings.eventName,
      settings.eventTagline,
      settings.eventSubheading,
      settings.eventDescription,
      settings.presenterName,
      settings.featuredArtist,
      settings.eventDate,
      settings.eventTime,
      settings.venueName,
      settings.venueAddress,
      settings.city,
      settings.feeCents,
      settings.applicationsOpen ? 1 : 0,
      settings.submissionDeadline,
      settings.cashappCashtag,
      settings.cashappQrKey,
      settings.artworkKey,
      settings.paymentProvider,
      settings.contactEmail,
      settings.contactPhone,
      settings.instagramUrl,
      genresToText(settings.genreOptions),
      settings.emailFromName,
      settings.emailReplyTo,
      settings.termsText,
      settings.privacyText,
      settings.refundText,
      settings.legalIsDraft ? 1 : 0,
      settings.pendingEmailSubject,
      settings.pendingEmailBody,
      settings.confirmationEmailSubject,
      settings.confirmationEmailBody,
      settings.approvedEmailSubject,
      settings.approvedEmailBody,
      settings.waitlistEmailSubject,
      settings.waitlistEmailBody,
      settings.declinedEmailSubject,
      settings.declinedEmailBody,
      settings.updatedAt,
    ],
  );
}

export async function ensureReady(db: Database): Promise<void> {
  if (ready.has(db)) return;
  await db.exec(SCHEMA_SQL);
  const counter = await db.get("SELECT value FROM id_counters WHERE name = 'submission'");
  if (!counter) {
    await db.run("INSERT INTO id_counters (name, value) VALUES ('submission', 0)");
  }
  const existing = await db.get("SELECT id FROM settings WHERE id = 1");
  if (!existing) await insertSettings(db, defaultSettings());
  const settingsColumns = ["event_subheading TEXT NOT NULL DEFAULT ''"];
  const extraColumns = [
    "file_hold TEXT NOT NULL DEFAULT 'disk'",
    "drive_folder_id TEXT NOT NULL DEFAULT ''",
    "photo_drive_id TEXT NOT NULL DEFAULT ''",
    "song1_drive_id TEXT NOT NULL DEFAULT ''",
    "song2_drive_id TEXT NOT NULL DEFAULT ''",
    "info_drive_id TEXT NOT NULL DEFAULT ''",
    "photo_sha256 TEXT NOT NULL DEFAULT ''",
    "song1_sha256 TEXT NOT NULL DEFAULT ''",
    "song2_sha256 TEXT NOT NULL DEFAULT ''",
    "info_sha256 TEXT NOT NULL DEFAULT ''",
    "synced_at TEXT NOT NULL DEFAULT ''",
  ];
  for (const column of settingsColumns) {
    try {
      await db.run(`ALTER TABLE settings ADD COLUMN ${column}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column/i.test(message)) throw error;
    }
  }
  for (const column of extraColumns) {
    try {
      await db.run(`ALTER TABLE submissions ADD COLUMN ${column}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column/i.test(message)) throw error;
    }
  }
  const seeded = defaultSettings();
  await db.run(
    `UPDATE settings SET
      event_tagline = ?, event_subheading = ?, event_description = ?,
      featured_artist = ?, event_date = ?, event_time = ?,
      venue_name = ?, venue_address = ?, city = ?, updated_at = ?
     WHERE venue_name = 'To be announced' OR event_date = 'To be announced'`,
    [
      seeded.eventTagline,
      seeded.eventSubheading,
      seeded.eventDescription,
      seeded.featuredArtist,
      seeded.eventDate,
      seeded.eventTime,
      seeded.venueName,
      seeded.venueAddress,
      seeded.city,
      new Date().toISOString(),
    ],
  );
  ready.add(db);
}

export async function getSettings(db: Database): Promise<Settings> {
  await ensureReady(db);
  const row = await db.get("SELECT * FROM settings WHERE id = 1");
  if (!row) throw new Error("Settings row is missing.");
  return mapSettings(row);
}

const SETTING_COLUMNS: Record<keyof Settings, string> = {
  eventName: "event_name",
  eventTagline: "event_tagline",
  eventSubheading: "event_subheading",
  eventDescription: "event_description",
  presenterName: "presenter_name",
  featuredArtist: "featured_artist",
  eventDate: "event_date",
  eventTime: "event_time",
  venueName: "venue_name",
  venueAddress: "venue_address",
  city: "city",
  feeCents: "fee_cents",
  applicationsOpen: "applications_open",
  submissionDeadline: "submission_deadline",
  cashappCashtag: "cashapp_cashtag",
  cashappQrKey: "cashapp_qr_key",
  artworkKey: "artwork_key",
  paymentProvider: "payment_provider",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  instagramUrl: "instagram_url",
  genreOptions: "genre_options",
  emailFromName: "email_from_name",
  emailReplyTo: "email_reply_to",
  termsText: "terms_text",
  privacyText: "privacy_text",
  refundText: "refund_text",
  legalIsDraft: "legal_is_draft",
  pendingEmailSubject: "pending_email_subject",
  pendingEmailBody: "pending_email_body",
  confirmationEmailSubject: "confirmation_email_subject",
  confirmationEmailBody: "confirmation_email_body",
  approvedEmailSubject: "approved_email_subject",
  approvedEmailBody: "approved_email_body",
  waitlistEmailSubject: "waitlist_email_subject",
  waitlistEmailBody: "waitlist_email_body",
  declinedEmailSubject: "declined_email_subject",
  declinedEmailBody: "declined_email_body",
  updatedAt: "updated_at",
};

export async function updateSettings(
  db: Database,
  patch: Partial<Settings>,
): Promise<Settings> {
  await ensureReady(db);
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(SETTING_COLUMNS) as (keyof Settings)[]) {
    if (patch[key] === undefined || key === "updatedAt") continue;
    assignments.push(`${SETTING_COLUMNS[key]} = ?`);
    const value = patch[key];
    if (key === "genreOptions" && Array.isArray(value)) params.push(genresToText(value));
    else if (typeof value === "boolean") params.push(value ? 1 : 0);
    else params.push(value);
  }
  assignments.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(1);
  await db.run(`UPDATE settings SET ${assignments.join(", ")} WHERE id = ?`, params);
  return getSettings(db);
}

export async function addStatusEvent(
  db: Database,
  input: { submissionId: string; fromStatus: string; toStatus: string; actor: string; note?: string },
): Promise<void> {
  await db.run(
    `INSERT INTO status_events (id, submission_id, from_status, to_status, actor, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.submissionId,
      input.fromStatus,
      input.toStatus,
      input.actor,
      input.note ?? "",
      new Date().toISOString(),
    ],
  );
}

export async function createSubmission(
  db: Database,
  profile: ProfileInput,
): Promise<{ submission: Submission; resumeToken: string }> {
  return db.transaction(async () => {
    await db.run("UPDATE id_counters SET value = value + 1 WHERE name = 'submission'");
    const counter = await db.get<{ value: number }>(
      "SELECT value FROM id_counters WHERE name = 'submission'",
    );
    const publicId = formatPublicId(num(counter?.value));
    const id = randomUUID();
    const resumeToken = randomToken();
    const resumeHash = await hashToken(resumeToken);
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO submissions (
        id, public_id, resume_hash, status, artist_name, legal_name, email, phone, city, state,
        instagram, genre, bio, organizer_note, song1_title, song2_title, photo_key, photo_name,
        photo_bytes, song1_key, song1_name, song1_bytes, song2_key, song2_name, song2_bytes,
        ack_terms, ack_privacy, ack_refund, ack_rights, ack_photo, ack_fee, acked_at,
        payment_provider, payer_name, payer_cashtag, payment_note, payment_claimed_at, paid_at,
        paid_by, paid_amount_cents, payment_reference, provider_session_id, refunded_at,
        refunded_by, refund_note, decision_email_sent_at, confirmation_email_sent_at,
        pending_email_sent_at, created_at, updated_at
      ) VALUES (${Array(50).fill("?").join(", ")})`,
      [
        id,
        publicId,
        resumeHash,
        "draft",
        profile.artistName,
        profile.legalName,
        profile.email,
        profile.phone,
        profile.city,
        profile.state,
        profile.instagram,
        profile.genre,
        profile.bio,
        profile.organizerNote,
        profile.song1Title,
        profile.song2Title,
        "",
        "",
        0,
        "",
        "",
        0,
        "",
        "",
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        now,
        now,
      ],
    );
    await addStatusEvent(db, {
      submissionId: id,
      fromStatus: "",
      toStatus: "draft",
      actor: "artist",
      note: "Application started",
    });
    const submission = await mustGet(db, id);
    return { submission, resumeToken };
  });
}

async function mustGet(db: Database, id: string): Promise<Submission> {
  const row = await db.get("SELECT * FROM submissions WHERE id = ?", [id]);
  if (!row) throw new Error("Submission disappeared.");
  return mapSubmission(row);
}

export async function getSubmission(db: Database, id: string): Promise<Submission | null> {
  const row = await db.get("SELECT * FROM submissions WHERE id = ?", [id]);
  return row ? mapSubmission(row) : null;
}

export async function getByPublicId(db: Database, publicId: string): Promise<Submission | null> {
  const row = await db.get("SELECT * FROM submissions WHERE public_id = ?", [publicId]);
  return row ? mapSubmission(row) : null;
}

export async function getByResumeToken(db: Database, token: string): Promise<Submission | null> {
  const hash = await hashToken(token);
  const row = await db.get("SELECT * FROM submissions WHERE resume_hash = ?", [hash]);
  return row ? mapSubmission(row) : null;
}

export async function saveProfile(
  db: Database,
  id: string,
  profile: ProfileInput,
): Promise<Submission> {
  await db.run(
    `UPDATE submissions SET artist_name = ?, legal_name = ?, email = ?, phone = ?, city = ?,
      state = ?, instagram = ?, genre = ?, bio = ?, organizer_note = ?, song1_title = ?,
      song2_title = ?, updated_at = ? WHERE id = ?`,
    [
      profile.artistName,
      profile.legalName,
      profile.email,
      profile.phone,
      profile.city,
      profile.state,
      profile.instagram,
      profile.genre,
      profile.bio,
      profile.organizerNote,
      profile.song1Title,
      profile.song2Title,
      new Date().toISOString(),
      id,
    ],
  );
  return mustGet(db, id);
}

const FILE_COLUMNS: Record<FileKind, { key: string; name: string; bytes: string }> = {
  photo: { key: "photo_key", name: "photo_name", bytes: "photo_bytes" },
  song1: { key: "song1_key", name: "song1_name", bytes: "song1_bytes" },
  song2: { key: "song2_key", name: "song2_name", bytes: "song2_bytes" },
};

export async function attachFile(
  db: Database,
  id: string,
  kind: FileKind,
  file: { key: string; name: string; bytes: number },
): Promise<Submission> {
  const columns = FILE_COLUMNS[kind];
  await db.run(
    `UPDATE submissions SET ${columns.key} = ?, ${columns.name} = ?, ${columns.bytes} = ?, updated_at = ? WHERE id = ?`,
    [file.key, file.name, file.bytes, new Date().toISOString(), id],
  );
  return mustGet(db, id);
}

export async function saveAcknowledgments(
  db: Database,
  id: string,
  acks: {
    ackTerms: boolean;
    ackPrivacy: boolean;
    ackRefund: boolean;
    ackRights: boolean;
    ackPhoto: boolean;
    ackFee: boolean;
  },
): Promise<Submission> {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE submissions SET ack_terms = ?, ack_privacy = ?, ack_refund = ?, ack_rights = ?,
      ack_photo = ?, ack_fee = ?, acked_at = ?, updated_at = ? WHERE id = ?`,
    [
      acks.ackTerms ? 1 : 0,
      acks.ackPrivacy ? 1 : 0,
      acks.ackRefund ? 1 : 0,
      acks.ackRights ? 1 : 0,
      acks.ackPhoto ? 1 : 0,
      acks.ackFee ? 1 : 0,
      now,
      now,
      id,
    ],
  );
  return mustGet(db, id);
}

const SUBMISSION_COLUMNS: Partial<Record<keyof Submission, string>> = {
  status: "status",
  artistName: "artist_name",
  legalName: "legal_name",
  email: "email",
  phone: "phone",
  city: "city",
  state: "state",
  instagram: "instagram",
  genre: "genre",
  bio: "bio",
  organizerNote: "organizer_note",
  song1Title: "song1_title",
  song2Title: "song2_title",
  photoKey: "photo_key",
  photoName: "photo_name",
  photoBytes: "photo_bytes",
  song1Key: "song1_key",
  song1Name: "song1_name",
  song1Bytes: "song1_bytes",
  song2Key: "song2_key",
  song2Name: "song2_name",
  song2Bytes: "song2_bytes",
  ackTerms: "ack_terms",
  ackPrivacy: "ack_privacy",
  ackRefund: "ack_refund",
  ackRights: "ack_rights",
  ackPhoto: "ack_photo",
  ackFee: "ack_fee",
  ackedAt: "acked_at",
  paymentProvider: "payment_provider",
  payerName: "payer_name",
  payerCashtag: "payer_cashtag",
  paymentNote: "payment_note",
  paymentClaimedAt: "payment_claimed_at",
  paidAt: "paid_at",
  paidBy: "paid_by",
  paidAmountCents: "paid_amount_cents",
  paymentReference: "payment_reference",
  providerSessionId: "provider_session_id",
  refundedAt: "refunded_at",
  refundedBy: "refunded_by",
  refundNote: "refund_note",
  decisionEmailSentAt: "decision_email_sent_at",
  confirmationEmailSentAt: "confirmation_email_sent_at",
  pendingEmailSentAt: "pending_email_sent_at",
  fileHold: "file_hold",
  driveFolderId: "drive_folder_id",
  photoDriveId: "photo_drive_id",
  song1DriveId: "song1_drive_id",
  song2DriveId: "song2_drive_id",
  infoDriveId: "info_drive_id",
  photoSha256: "photo_sha256",
  song1Sha256: "song1_sha256",
  song2Sha256: "song2_sha256",
  infoSha256: "info_sha256",
  syncedAt: "synced_at",
};

export async function patchSubmission(
  db: Database,
  id: string,
  patch: Partial<Submission>,
): Promise<Submission> {
  const sets = ["updated_at = ?"];
  const params: unknown[] = [new Date().toISOString()];
  for (const key of Object.keys(SUBMISSION_COLUMNS) as (keyof Submission)[]) {
    if (patch[key] === undefined) continue;
    const column = SUBMISSION_COLUMNS[key];
    if (!column) continue;
    sets.push(`${column} = ?`);
    const value = patch[key];
    params.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
  }
  params.push(id);
  await db.run(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`, params);
  return mustGet(db, id);
}

export async function setStatus(
  db: Database,
  id: string,
  status: SubmissionStatus,
  patch: Partial<Submission> | null,
  event: { fromStatus: string; actor: string; note: string },
): Promise<Submission> {
  await patchSubmission(db, id, { ...(patch ?? {}), status });
  await addStatusEvent(db, {
    submissionId: id,
    fromStatus: event.fromStatus,
    toStatus: status,
    actor: event.actor,
    note: event.note,
  });
  return mustGet(db, id);
}

export async function listSubmissions(
  db: Database,
  query: { q?: string; status?: string; limit: number; offset: number },
): Promise<{ rows: Submission[]; total: number }> {
  const q = (query.q ?? "").trim().toLowerCase().replace(/[\\%_]/g, "");
  const like = q ? `%${q}%` : "";
  const status = query.status ?? "";
  const where = `WHERE (? = '' OR status = ?) AND (? = '' OR lower(public_id) LIKE ? OR lower(artist_name) LIKE ?
    OR lower(legal_name) LIKE ? OR lower(email) LIKE ? OR lower(phone) LIKE ? OR lower(payer_name) LIKE ?
    OR lower(payer_cashtag) LIKE ? OR lower(payment_note) LIKE ?)`;
  const params = [status, status, like, like, like, like, like, like, like, like, like];
  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) AS total FROM submissions ${where}`,
    params,
  );
  const rows = await db.all(
    `SELECT * FROM submissions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, query.offset],
  );
  return { rows: rows.map(mapSubmission), total: num(totalRow?.total) };
}

export async function submissionStats(db: Database): Promise<{
  byStatus: Record<string, number>;
  total: number;
  revenueCents: number;
  refundedCents: number;
}> {
  const grouped = await db.all<{ status: string; c: number }>(
    "SELECT status, COUNT(*) AS c FROM submissions GROUP BY status",
  );
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    byStatus[str(row.status)] = num(row.c);
    total += num(row.c);
  }
  const revenue = await db.get<{ cents: number }>(
    "SELECT COALESCE(SUM(paid_amount_cents), 0) AS cents FROM submissions WHERE paid_at != '' AND refunded_at = ''",
  );
  const refunded = await db.get<{ cents: number }>(
    "SELECT COALESCE(SUM(paid_amount_cents), 0) AS cents FROM submissions WHERE refunded_at != ''",
  );
  return {
    byStatus,
    total,
    revenueCents: num(revenue?.cents),
    refundedCents: num(refunded?.cents),
  };
}

export async function listEvents(db: Database, submissionId: string): Promise<StatusEvent[]> {
  const rows = await db.all(
    "SELECT * FROM status_events WHERE submission_id = ? ORDER BY created_at ASC",
    [submissionId],
  );
  return rows.map((row) => ({
    id: str(row.id),
    submissionId: str(row.submission_id),
    fromStatus: str(row.from_status),
    toStatus: str(row.to_status),
    actor: str(row.actor),
    note: str(row.note),
    createdAt: str(row.created_at),
  }));
}

export async function listNotes(db: Database, submissionId: string): Promise<SubmissionNote[]> {
  const rows = await db.all(
    "SELECT * FROM submission_notes WHERE submission_id = ? ORDER BY created_at ASC",
    [submissionId],
  );
  return rows.map((row) => ({
    id: str(row.id),
    submissionId: str(row.submission_id),
    body: str(row.body),
    createdAt: str(row.created_at),
  }));
}

export async function addNote(db: Database, submissionId: string, body: string): Promise<void> {
  await db.run(
    "INSERT INTO submission_notes (id, submission_id, body, created_at) VALUES (?, ?, ?, ?)",
    [randomUUID(), submissionId, body, new Date().toISOString()],
  );
}

export async function findWebhook(
  db: Database,
  provider: string,
  eventId: string,
): Promise<{ result: string; submissionId: string } | null> {
  const row = await db.get(
    "SELECT result, submission_id FROM webhook_events WHERE provider = ? AND event_id = ?",
    [provider, eventId],
  );
  if (!row) return null;
  return { result: str(row.result), submissionId: str(row.submission_id) };
}

export async function insertWebhook(
  db: Database,
  input: { provider: string; eventId: string; submissionId: string; result: string },
): Promise<void> {
  await db.run(
    `INSERT INTO webhook_events (id, provider, event_id, submission_id, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.provider,
      input.eventId,
      input.submissionId,
      input.result,
      new Date().toISOString(),
    ],
  );
}

export async function logEmail(
  db: Database,
  input: {
    submissionId: string;
    template: EmailTemplateName | string;
    toEmail: string;
    subject: string;
    status: string;
    detail: string;
  },
): Promise<void> {
  await db.run(
    `INSERT INTO email_log (id, submission_id, template, to_email, subject, status, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.submissionId,
      input.template,
      input.toEmail,
      input.subject,
      input.status,
      input.detail,
      new Date().toISOString(),
    ],
  );
}

export async function listEmails(db: Database, submissionId: string) {
  const rows = await db.all(
    "SELECT * FROM email_log WHERE submission_id = ? ORDER BY created_at ASC",
    [submissionId],
  );
  return rows.map((row) => ({
    id: str(row.id),
    template: str(row.template),
    toEmail: str(row.to_email),
    subject: str(row.subject),
    status: str(row.status),
    detail: str(row.detail),
    createdAt: str(row.created_at),
  }));
}

export async function deleteSubmissionRow(db: Database, id: string): Promise<void> {
  await db.transaction(async () => {
    await db.run("DELETE FROM submission_notes WHERE submission_id = ?", [id]);
    await db.run("DELETE FROM status_events WHERE submission_id = ?", [id]);
    await db.run("DELETE FROM email_log WHERE submission_id = ?", [id]);
    await db.run("DELETE FROM webhook_events WHERE submission_id = ?", [id]);
    await db.run("DELETE FROM submissions WHERE id = ?", [id]);
  });
}

export function fileKeys(submission: Submission): string[] {
  return [submission.photoKey, submission.song1Key, submission.song2Key].filter(Boolean);
}
