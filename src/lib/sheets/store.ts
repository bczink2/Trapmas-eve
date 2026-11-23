import { randomUUID } from "crypto";
import { googleDriveClient } from "@/lib/drive/google";
import { AppError } from "@/lib/errors";
import { formatPublicId, hashToken, randomToken } from "@/lib/ids";
import type { ProfileInput } from "@/lib/profile";
import { mainFolderName } from "@/lib/sync-lib.mjs";
import type { SheetBook, SheetTab } from "@/lib/sheets/book";
import { SheetBook as OpenBook } from "@/lib/sheets/book";
import {
  bytesField,
  driveField,
  nameField,
  rowObject,
  settingsFromPairs,
  settingsPairs,
  shaField,
  submissionFromRow,
  submissionRow,
} from "@/lib/sheets/codec";
import { makeLock, type Store, type UploadRecord } from "@/lib/store";
import type { FileKind, Settings, Submission, SubmissionStatus } from "@/lib/types";

function keyField(kind: FileKind): "photoKey" | "song1Key" | "song2Key" {
  if (kind === "photo") return "photoKey";
  if (kind === "song1") return "song1Key";
  return "song2Key";
}

export async function sheetsStore(): Promise<Store> {
  return sheetsStoreFrom(await OpenBook.open());
}

export function sheetsStoreFrom(book: SheetBook): Store {
  const lock = makeLock();

  async function grid(tab: SheetTab) {
    const rows = await book.values(tab);
    const header = rows[0] || [];
    return { header, data: rows.slice(1) };
  }

  async function allSubmissions(): Promise<Submission[]> {
    const { header, data } = await grid("submissions");
    return data.map((row) => submissionFromRow(header, row)).filter((row): row is Submission => Boolean(row));
  }

  async function must(id: string): Promise<Submission> {
    const found = (await allSubmissions()).find((row) => row.id === id);
    if (!found) throw new AppError(404, "Submission not found.", "not_found");
    return found;
  }

  async function save(submission: Submission): Promise<Submission> {
    const { header, data } = await grid("submissions");
    const idAt = Math.max(0, header.indexOf("id"));
    const index = data.findIndex((row) => row[idAt] === submission.id);
    if (index < 0) await book.append("submissions", submissionRow(submission));
    else await book.writeRow("submissions", index + 2, submissionRow(submission));
    return submission;
  }

  async function patch(id: string, patch: Partial<Submission>): Promise<Submission> {
    const next = { ...(await must(id)), ...patch, updatedAt: new Date().toISOString() };
    return save(next);
  }

  async function getSettings(): Promise<Settings> {
    const { data } = await grid("settings");
    return settingsFromPairs(data.filter((row) => row[0]));
  }

  async function setMeta(key: string, value: string) {
    const { data } = await grid("meta");
    const index = data.findIndex((row) => row[0] === key);
    if (index < 0) await book.append("meta", [key, value]);
    else await book.writeRow("meta", index + 2, [key, value]);
  }

  async function nextPublicId(): Promise<string> {
    const { data } = await grid("meta");
    let seq = Number(data.find((row) => row[0] === "submission_seq")?.[1] || 0);
    for (const submission of await allSubmissions()) {
      const match = /TRAP-(\d+)/i.exec(submission.publicId);
      if (match) seq = Math.max(seq, Number(match[1]));
    }
    const next = seq + 1;
    await setMeta("submission_seq", String(next));
    return formatPublicId(next);
  }

  async function removeDrive(submission: Submission) {
    const drive = googleDriveClient();
    for (const fileId of [submission.photoDriveId, submission.song1DriveId, submission.song2DriveId, submission.infoDriveId]) {
      if (fileId) await drive.remove(fileId).catch(() => undefined);
    }
    if (submission.driveFolderId) await drive.remove(submission.driveFolderId).catch(() => undefined);
  }

  async function deleteMatching(tab: SheetTab, submissionId: string) {
    const { header, data } = await grid(tab);
    const column = header.indexOf("submissionId");
    if (column < 0) return;
    for (let index = data.length - 1; index >= 0; index -= 1) {
      if (data[index]?.[column] === submissionId) await book.deleteDataRow(tab, index);
    }
  }

  const impl: Store = {
    kind: "sheets",
    getSettings,
    async updateSettings(patch) {
      const next = { ...(await getSettings()), ...patch, updatedAt: new Date().toISOString() };
      await book.writeGrid("settings", [["key", "value"], ...settingsPairs(next)]);
      return next;
    },
    async createSubmission(profile: ProfileInput) {
      const publicId = await nextPublicId();
      const now = new Date().toISOString();
      const resumeToken = randomToken();
      const submission: Submission = {
        ...(await mustSafeBlank(profile, publicId, await hashToken(resumeToken), now)),
      };
      await save(submission);
      await book.append("events", [randomUUID(), submission.id, "", "draft", "artist", "Application started", now]);
      try {
        const drive = googleDriveClient();
        const eventName = mainFolderName((await getSettings()).eventName, (await getSettings()).featuredArtist);
        const pending = await drive.ensureFolder(
          await drive.ensureFolder(process.env.GOOGLE_DRIVE_FOLDER_ID || "", eventName),
          "Pending",
        );
        const folder = await drive.ensureFolder(pending, publicId);
        submission.driveFolderId = folder;
        submission.fileHold = "pending";
        await save(submission);
      } catch (error) {
        await deleteMatching("events", submission.id);
        const { header, data } = await grid("submissions");
        const idAt = Math.max(0, header.indexOf("id"));
        const index = data.findIndex((row) => row[idAt] === submission.id);
        if (index >= 0) await book.deleteDataRow("submissions", index);
        throw error;
      }
      return { submission, resumeToken };
    },
    async getSubmission(id) {
      return (await allSubmissions()).find((row) => row.id === id) ?? null;
    },
    async getByPublicId(publicId) {
      return (await allSubmissions()).find((row) => row.publicId === publicId) ?? null;
    },
    async getByResumeToken(token) {
      const hash = await hashToken(token);
      return (await allSubmissions()).find((row) => row.resumeHash === hash) ?? null;
    },
    async saveProfile(id, profile) {
      return patch(id, { ...profile });
    },
    async saveAcknowledgments(id, acks) {
      return patch(id, { ...acks, ackedAt: new Date().toISOString() });
    },
    async setStatus(id, status, extra, event) {
      const updated = await patch(id, { ...(extra ?? {}), status });
      await book.append("events", [
        randomUUID(),
        id,
        event.fromStatus,
        status,
        event.actor,
        event.note,
        new Date().toISOString(),
      ]);
      return updated;
    },
    patch,
    async recordUpload(id, kind, file: UploadRecord) {
      const current = await must(id);
      const previous = current[driveField(kind)];
      const next = await patch(id, {
        [keyField(kind)]: file.key,
        [nameField(kind)]: file.name,
        [bytesField(kind)]: file.bytes,
        ...(file.driveId ? { [driveField(kind)]: file.driveId, fileHold: "pending" as const } : {}),
        ...(file.sha256 ? { [shaField(kind)]: file.sha256 } : {}),
        ...(file.folderId ? { driveFolderId: file.folderId } : {}),
      });
      if (previous && file.driveId && previous !== file.driveId) {
        await googleDriveClient().remove(previous).catch(() => undefined);
      }
      return next;
    },
    async ensurePendingFolder(submission) {
      if (submission.driveFolderId) return submission;
      const drive = googleDriveClient();
      const current = await getSettings();
      const pending = await drive.ensureFolder(
        await drive.ensureFolder(
          process.env.GOOGLE_DRIVE_FOLDER_ID || "",
          mainFolderName(current.eventName, current.featuredArtist),
        ),
        "Pending",
      );
      const folder = await drive.ensureFolder(pending, submission.publicId);
      return patch(submission.id, { driveFolderId: folder, fileHold: "pending" });
    },
    async listSubmissions(query) {
      const q = (query.q ?? "").trim().toLowerCase();
      let rows = await allSubmissions();
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      if (q) {
        rows = rows.filter((row) =>
          [row.publicId, row.artistName, row.legalName, row.email, row.phone, row.payerName, row.payerCashtag, row.paymentNote]
            .join("\n")
            .toLowerCase()
            .includes(q),
        );
      }
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.publicId.localeCompare(a.publicId));
      return { rows: rows.slice(query.offset, query.offset + query.limit), total: rows.length };
    },
    async submissionStats() {
      const rows = await allSubmissions();
      const byStatus: Record<string, number> = {};
      let revenueCents = 0;
      let refundedCents = 0;
      for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1;
        if (row.paidAt && !row.refundedAt) revenueCents += row.paidAmountCents;
        if (row.refundedAt) refundedCents += row.paidAmountCents;
      }
      return { byStatus, total: rows.length, revenueCents, refundedCents };
    },
    async listEvents(submissionId) {
      const { header, data } = await grid("events");
      return data
        .map((row) => rowObject(header, row))
        .filter((row) => row.submissionId === submissionId)
        .map((row) => ({
          id: row.id,
          submissionId: row.submissionId,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          actor: row.actor,
          note: row.note,
          createdAt: row.createdAt,
        }));
    },
    async listNotes(submissionId) {
      const { header, data } = await grid("notes");
      return data
        .map((row) => rowObject(header, row))
        .filter((row) => row.submissionId === submissionId)
        .map((row) => ({
          id: row.id,
          submissionId: row.submissionId,
          body: row.body,
          createdAt: row.createdAt,
        }));
    },
    async addNote(submissionId, body) {
      await book.append("notes", [randomUUID(), submissionId, body, new Date().toISOString()]);
    },
    async findWebhook(provider, eventId) {
      const { header, data } = await grid("webhooks");
      const found = data.map((row) => rowObject(header, row)).find((row) => row.provider === provider && row.eventId === eventId);
      if (!found) return null;
      return { result: found.result || "", submissionId: found.submissionId || "" };
    },
    async insertWebhook(input) {
      const existing = await impl.findWebhook(input.provider, input.eventId);
      if (existing) throw new Error("UNIQUE constraint failed: webhook_events");
      await book.append("webhooks", [
        randomUUID(),
        input.provider,
        input.eventId,
        input.submissionId,
        input.result,
        new Date().toISOString(),
      ]);
    },
    async logEmail(input) {
      await book.append("emails", [
        randomUUID(),
        input.submissionId,
        input.template,
        input.toEmail,
        input.subject,
        input.status,
        input.detail,
        new Date().toISOString(),
      ]);
    },
    async listEmails(submissionId) {
      const { header, data } = await grid("emails");
      return data
        .map((row) => rowObject(header, row))
        .filter((row) => row.submissionId === submissionId)
        .map((row) => ({
          id: row.id || "",
          template: row.template || "",
          toEmail: row.toEmail || "",
          subject: row.subject || "",
          status: row.status || "",
          detail: row.detail || "",
          createdAt: row.createdAt || "",
        }));
    },
    async deleteSubmission(id) {
      const submission = await must(id);
      await removeDrive(submission);
      await deleteMatching("notes", id);
      await deleteMatching("events", id);
      await deleteMatching("emails", id);
      await deleteMatching("webhooks", id);
      const { header, data } = await grid("submissions");
      const idAt = Math.max(0, header.indexOf("id"));
      const index = data.findIndex((row) => row[idAt] === id);
      if (index >= 0) await book.deleteDataRow("submissions", index);
    },
    async cleanupAbandoned(days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      let count = 0;
      for (const submission of await allSubmissions()) {
        if (submission.status !== "draft" && submission.status !== "awaiting_payment") continue;
        const created = Date.parse(submission.createdAt);
        if (!Number.isFinite(created) || created > cutoff) continue;
        await removeDrive(submission);
        await impl.setStatus(submission.id, "expired", { driveFolderId: "", photoDriveId: "", song1DriveId: "", song2DriveId: "" }, {
          fromStatus: submission.status,
          actor: "system",
          note: `Abandoned draft removed from Drive after ${days} days.`,
        });
        count += 1;
      }
      return count;
    },
    transaction: (fn) => fn(),
  };

  return {
    ...impl,
    getSettings: () => lock(() => impl.getSettings()),
    updateSettings: (patch) => lock(() => impl.updateSettings(patch)),
    createSubmission: (profile) => lock(() => impl.createSubmission(profile)),
    getSubmission: (id) => lock(() => impl.getSubmission(id)),
    getByPublicId: (id) => lock(() => impl.getByPublicId(id)),
    getByResumeToken: (token) => lock(() => impl.getByResumeToken(token)),
    saveProfile: (id, profile) => lock(() => impl.saveProfile(id, profile)),
    saveAcknowledgments: (id, acks) => lock(() => impl.saveAcknowledgments(id, acks)),
    setStatus: (id, status, patch, event) => lock(() => impl.setStatus(id, status, patch, event)),
    patch: (id, patch) => lock(() => impl.patch(id, patch)),
    recordUpload: (id, kind, file) => lock(() => impl.recordUpload(id, kind, file)),
    ensurePendingFolder: (submission) => lock(() => impl.ensurePendingFolder(submission)),
    listSubmissions: (query) => lock(() => impl.listSubmissions(query)),
    submissionStats: () => lock(() => impl.submissionStats()),
    listEvents: (id) => lock(() => impl.listEvents(id)),
    listNotes: (id) => lock(() => impl.listNotes(id)),
    addNote: (id, body) => lock(() => impl.addNote(id, body)),
    findWebhook: (provider, eventId) => lock(() => impl.findWebhook(provider, eventId)),
    insertWebhook: (input) => lock(() => impl.insertWebhook(input)),
    logEmail: (input) => lock(() => impl.logEmail(input)),
    listEmails: (id) => lock(() => impl.listEmails(id)),
    deleteSubmission: (id) => lock(() => impl.deleteSubmission(id)),
    cleanupAbandoned: (days) => lock(() => impl.cleanupAbandoned(days)),
    transaction: (fn) => lock(fn),
  };
}

function mustSafeBlank(profile: ProfileInput, publicId: string, resumeHash: string, now: string): Submission {
  return {
    id: randomUUID(),
    publicId,
    resumeHash,
    status: "draft" as SubmissionStatus,
    artistName: profile.artistName,
    legalName: profile.legalName,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    state: profile.state,
    instagram: profile.instagram,
    genre: profile.genre,
    bio: profile.bio,
    organizerNote: profile.organizerNote,
    song1Title: profile.song1Title,
    song2Title: profile.song2Title,
    photoKey: "",
    photoName: "",
    photoBytes: 0,
    song1Key: "",
    song1Name: "",
    song1Bytes: 0,
    song2Key: "",
    song2Name: "",
    song2Bytes: 0,
    ackTerms: false,
    ackPrivacy: false,
    ackRefund: false,
    ackRights: false,
    ackPhoto: false,
    ackFee: false,
    ackedAt: "",
    paymentProvider: "",
    payerName: "",
    payerCashtag: "",
    paymentNote: "",
    paymentClaimedAt: "",
    paidAt: "",
    paidBy: "",
    paidAmountCents: 0,
    paymentReference: "",
    providerSessionId: "",
    refundedAt: "",
    refundedBy: "",
    refundNote: "",
    decisionEmailSentAt: "",
    confirmationEmailSentAt: "",
    pendingEmailSentAt: "",
    fileHold: "pending",
    driveFolderId: "",
    photoDriveId: "",
    song1DriveId: "",
    song2DriveId: "",
    infoDriveId: "",
    photoSha256: "",
    song1Sha256: "",
    song2Sha256: "",
    infoSha256: "",
    syncedAt: "",
    createdAt: now,
    updatedAt: now,
  };
}
