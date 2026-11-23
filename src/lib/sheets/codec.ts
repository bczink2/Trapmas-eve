import { defaultSettings } from "@/lib/defaults";
import type { FileKind, Settings, Submission, SubmissionStatus } from "@/lib/types";
import { PAYMENT_PROVIDERS } from "@/lib/types";

export const SUBMISSION_KEYS = [
  "id",
  "publicId",
  "resumeHash",
  "status",
  "artistName",
  "legalName",
  "email",
  "phone",
  "city",
  "state",
  "instagram",
  "genre",
  "bio",
  "organizerNote",
  "song1Title",
  "song2Title",
  "photoKey",
  "photoName",
  "photoBytes",
  "song1Key",
  "song1Name",
  "song1Bytes",
  "song2Key",
  "song2Name",
  "song2Bytes",
  "ackTerms",
  "ackPrivacy",
  "ackRefund",
  "ackRights",
  "ackPhoto",
  "ackFee",
  "ackedAt",
  "paymentProvider",
  "payerName",
  "payerCashtag",
  "paymentNote",
  "paymentClaimedAt",
  "paidAt",
  "paidBy",
  "paidAmountCents",
  "paymentReference",
  "providerSessionId",
  "refundedAt",
  "refundedBy",
  "refundNote",
  "decisionEmailSentAt",
  "confirmationEmailSentAt",
  "pendingEmailSentAt",
  "fileHold",
  "driveFolderId",
  "photoDriveId",
  "song1DriveId",
  "song2DriveId",
  "infoDriveId",
  "photoSha256",
  "song1Sha256",
  "song2Sha256",
  "infoSha256",
  "syncedAt",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof Submission)[];

const BOOL_KEYS = new Set<keyof Submission>([
  "ackTerms",
  "ackPrivacy",
  "ackRefund",
  "ackRights",
  "ackPhoto",
  "ackFee",
]);

const NUM_KEYS = new Set<keyof Submission>(["photoBytes", "song1Bytes", "song2Bytes", "paidAmountCents"]);

export const EVENT_KEYS = ["id", "submissionId", "fromStatus", "toStatus", "actor", "note", "createdAt"] as const;
export const NOTE_KEYS = ["id", "submissionId", "body", "createdAt"] as const;
export const EMAIL_KEYS = ["id", "submissionId", "template", "toEmail", "subject", "status", "detail", "createdAt"] as const;
export const WEBHOOK_KEYS = ["id", "provider", "eventId", "submissionId", "result", "createdAt"] as const;

export function columnName(index1: number): string {
  let n = index1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function cell(value: unknown): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value == null) return "";
  return String(value);
}

export function submissionRow(submission: Submission): string[] {
  return SUBMISSION_KEYS.map((key) => cell(submission[key]));
}

export function blankSubmission(partial: Partial<Submission>): Submission {
  const empty = Object.fromEntries(
    SUBMISSION_KEYS.map((key) => [key, BOOL_KEYS.has(key) ? false : NUM_KEYS.has(key) ? 0 : ""]),
  ) as unknown as Submission;
  return { ...empty, fileHold: "pending", ...partial };
}

export function submissionFromRow(header: string[], row: string[]): Submission | null {
  const map = new Map<string, string>();
  header.forEach((key, index) => map.set(key, row[index] ?? ""));
  const id = map.get("id") || "";
  if (!id) return null;
  const submission = blankSubmission({});
  for (const key of SUBMISSION_KEYS) {
    const raw = map.get(key);
    if (raw == null || raw === "") continue;
    if (BOOL_KEYS.has(key)) {
      (submission[key] as boolean) = raw === "1" || raw === "true";
    } else if (NUM_KEYS.has(key)) {
      const parsed = Number(raw);
      (submission[key] as number) = Number.isFinite(parsed) ? parsed : 0;
    } else {
      (submission[key] as string) = raw;
    }
  }
  submission.status = (map.get("status") || "draft") as SubmissionStatus;
  const hold = map.get("fileHold");
  if (hold === "disk" || hold === "pending" || hold === "drive" || hold === "computer") submission.fileHold = hold;
  return submission;
}

export function rowObject(header: string[], row: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  header.forEach((key, index) => {
    map[key] = row[index] ?? "";
  });
  return map;
}

const SETTING_KEYS = Object.keys(defaultSettings()) as (keyof Settings)[];

export function settingsPairs(settings: Settings): string[][] {
  return SETTING_KEYS.map((key) => {
    const value = settings[key];
    if (key === "genreOptions" && Array.isArray(value)) return [key, value.join("\n")];
    return [key, cell(value)];
  });
}

export function settingsFromPairs(pairs: string[][]): Settings {
  const settings = defaultSettings();
  for (const [key, value] of pairs) {
    if (!key || !(key in settings)) continue;
    const typed = key as keyof Settings;
    if (typed === "genreOptions") {
      settings.genreOptions = value.split(/\n|,/).map((genre) => genre.trim()).filter(Boolean);
    } else if (typeof settings[typed] === "boolean") {
      (settings[typed] as boolean) = value === "1" || value === "true";
    } else if (typeof settings[typed] === "number") {
      const parsed = Number(value);
      (settings[typed] as number) = Number.isFinite(parsed) ? parsed : 0;
    } else if (typed === "paymentProvider") {
      settings.paymentProvider = PAYMENT_PROVIDERS.includes(value as Settings["paymentProvider"])
        ? (value as Settings["paymentProvider"])
        : "cashapp_manual";
    } else {
      (settings[typed] as string) = value;
    }
  }
  return settings;
}

export function driveField(kind: FileKind): "photoDriveId" | "song1DriveId" | "song2DriveId" {
  if (kind === "photo") return "photoDriveId";
  if (kind === "song1") return "song1DriveId";
  return "song2DriveId";
}

export function shaField(kind: FileKind): "photoSha256" | "song1Sha256" | "song2Sha256" {
  if (kind === "photo") return "photoSha256";
  if (kind === "song1") return "song1Sha256";
  return "song2Sha256";
}

export function nameField(kind: FileKind): "photoName" | "song1Name" | "song2Name" {
  if (kind === "photo") return "photoName";
  if (kind === "song1") return "song1Name";
  return "song2Name";
}

export function bytesField(kind: FileKind): "photoBytes" | "song1Bytes" | "song2Bytes" {
  if (kind === "photo") return "photoBytes";
  if (kind === "song1") return "song1Bytes";
  return "song2Bytes";
}
