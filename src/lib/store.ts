import { AsyncLocalStorage } from "node:async_hooks";
import { defaultSettings } from "@/lib/defaults";
import { getDb } from "@/lib/db/index";
import {
  addNote,
  attachFile,
  createSubmission,
  deleteSubmissionRow,
  findWebhook,
  getByPublicId,
  getByResumeToken,
  getSettings,
  getSubmission,
  insertWebhook,
  listEmails,
  listEvents,
  listNotes,
  listSubmissions,
  logEmail,
  patchSubmission,
  saveAcknowledgments,
  saveProfile,
  setStatus,
  submissionStats,
  updateSettings,
} from "@/lib/db/repo";
import type { Database } from "@/lib/db/sql";
import { driveConfigured } from "@/lib/drive/google";
import { AppError } from "@/lib/errors";
import type { ProfileInput } from "@/lib/profile";
import type { FileKind, Settings, StatusEvent, Submission, SubmissionNote, SubmissionStatus } from "@/lib/types";

export type EmailLog = {
  id: string;
  template: string;
  toEmail: string;
  subject: string;
  status: string;
  detail: string;
  createdAt: string;
};

export type UploadRecord = {
  key: string;
  name: string;
  bytes: number;
  driveId?: string;
  sha256?: string;
  folderId?: string;
};

export type Store = {
  kind: "sqlite" | "sheets" | "memory";
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  createSubmission(profile: ProfileInput): Promise<{ submission: Submission; resumeToken: string }>;
  getSubmission(id: string): Promise<Submission | null>;
  getByPublicId(publicId: string): Promise<Submission | null>;
  getByResumeToken(token: string): Promise<Submission | null>;
  saveProfile(id: string, profile: ProfileInput): Promise<Submission>;
  saveAcknowledgments(
    id: string,
    acks: {
      ackTerms: boolean;
      ackPrivacy: boolean;
      ackRefund: boolean;
      ackRights: boolean;
      ackPhoto: boolean;
      ackFee: boolean;
    },
  ): Promise<Submission>;
  setStatus(
    id: string,
    status: SubmissionStatus,
    patch: Partial<Submission> | null,
    event: { fromStatus: string; actor: string; note: string },
  ): Promise<Submission>;
  patch(id: string, patch: Partial<Submission>): Promise<Submission>;
  recordUpload(id: string, kind: FileKind, file: UploadRecord): Promise<Submission>;
  ensurePendingFolder(submission: Submission): Promise<Submission>;
  listSubmissions(query: { q?: string; status?: string; limit: number; offset: number }): Promise<{
    rows: Submission[];
    total: number;
  }>;
  submissionStats(): Promise<{ byStatus: Record<string, number>; total: number; revenueCents: number; refundedCents: number }>;
  listEvents(submissionId: string): Promise<StatusEvent[]>;
  listNotes(submissionId: string): Promise<SubmissionNote[]>;
  addNote(submissionId: string, body: string): Promise<void>;
  findWebhook(provider: string, eventId: string): Promise<{ result: string; submissionId: string } | null>;
  insertWebhook(input: { provider: string; eventId: string; submissionId: string; result: string }): Promise<void>;
  logEmail(input: {
    submissionId: string;
    template: string;
    toEmail: string;
    subject: string;
    status: string;
    detail: string;
  }): Promise<void>;
  listEmails(submissionId: string): Promise<EmailLog[]>;
  deleteSubmission(id: string): Promise<void>;
  cleanupAbandoned(days: number): Promise<number>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
};

const NOT_READY = "Google Drive is not connected yet, so this cannot be saved.";

function refused(): never {
  throw new AppError(503, NOT_READY, "not_configured");
}

export function memoryStore(): Store {
  const settings = defaultSettings();
  return {
    kind: "memory",
    getSettings: async () => settings,
    updateSettings: async () => refused(),
    createSubmission: async () => refused(),
    getSubmission: async () => null,
    getByPublicId: async () => null,
    getByResumeToken: async () => null,
    saveProfile: async () => refused(),
    saveAcknowledgments: async () => refused(),
    setStatus: async () => refused(),
    patch: async () => refused(),
    recordUpload: async () => refused(),
    ensurePendingFolder: async () => refused(),
    listSubmissions: async () => ({ rows: [], total: 0 }),
    submissionStats: async () => ({ byStatus: {}, total: 0, revenueCents: 0, refundedCents: 0 }),
    listEvents: async () => [],
    listNotes: async () => [],
    addNote: async () => refused(),
    findWebhook: async () => null,
    insertWebhook: async () => refused(),
    logEmail: async () => undefined,
    listEmails: async () => [],
    deleteSubmission: async () => refused(),
    cleanupAbandoned: async () => 0,
    transaction: async (fn) => fn(),
  };
}

function uploadPatch(kind: FileKind, file: UploadRecord): Partial<Submission> {
  if (kind === "photo") {
    return {
      photoKey: file.key,
      photoName: file.name,
      photoBytes: file.bytes,
      ...(file.driveId ? { photoDriveId: file.driveId, fileHold: "pending" as const } : {}),
      ...(file.sha256 ? { photoSha256: file.sha256 } : {}),
      ...(file.folderId ? { driveFolderId: file.folderId } : {}),
    };
  }
  if (kind === "song1") {
    return {
      song1Key: file.key,
      song1Name: file.name,
      song1Bytes: file.bytes,
      ...(file.driveId ? { song1DriveId: file.driveId, fileHold: "pending" as const } : {}),
      ...(file.sha256 ? { song1Sha256: file.sha256 } : {}),
      ...(file.folderId ? { driveFolderId: file.folderId } : {}),
    };
  }
  return {
    song2Key: file.key,
    song2Name: file.name,
    song2Bytes: file.bytes,
    ...(file.driveId ? { song2DriveId: file.driveId, fileHold: "pending" as const } : {}),
    ...(file.sha256 ? { song2Sha256: file.sha256 } : {}),
    ...(file.folderId ? { driveFolderId: file.folderId } : {}),
  };
}

export function sqliteStore(db: Database): Store {
  return {
    kind: "sqlite",
    getSettings: () => getSettings(db),
    updateSettings: (patch) => updateSettings(db, patch),
    createSubmission: (profile) => createSubmission(db, profile),
    getSubmission: (id) => getSubmission(db, id),
    getByPublicId: (publicId) => getByPublicId(db, publicId),
    getByResumeToken: (token) => getByResumeToken(db, token),
    saveProfile: (id, profile) => saveProfile(db, id, profile),
    saveAcknowledgments: (id, acks) => saveAcknowledgments(db, id, acks),
    setStatus: (id, status, patch, event) => setStatus(db, id, status, patch, event),
    patch: (id, patch) => patchSubmission(db, id, patch),
    async recordUpload(id, kind, file) {
      await attachFile(db, id, kind, file);
      return patchSubmission(db, id, uploadPatch(kind, file));
    },
    async ensurePendingFolder(submission) {
      return submission;
    },
    listSubmissions: (query) => listSubmissions(db, query),
    submissionStats: () => submissionStats(db),
    listEvents: (id) => listEvents(db, id),
    listNotes: (id) => listNotes(db, id),
    addNote: async (id, body) => {
      await addNote(db, id, body);
    },
    findWebhook: (provider, eventId) => findWebhook(db, provider, eventId),
    insertWebhook: (input) => insertWebhook(db, input),
    logEmail: (input) => logEmail(db, input),
    listEmails: (id) => listEmails(db, id),
    deleteSubmission: (id) => deleteSubmissionRow(db, id),
    cleanupAbandoned: async () => 0,
    transaction: (fn) => db.transaction(fn),
  };
}

let sheetsPromise: Promise<Store> | null = null;
let cleanupStarted = false;

export async function getStore(): Promise<Store> {
  if (driveConfigured()) {
    sheetsPromise ??= import("@/lib/sheets/store")
      .then((mod) => mod.sheetsStore())
      .catch((error) => {
        sheetsPromise = null;
        throw error;
      });
    const store = await sheetsPromise;
    if (!cleanupStarted) {
      cleanupStarted = true;
      const days = Number(process.env.DRAFT_TTL_DAYS ?? "14");
      if (Number.isFinite(days) && days > 0) {
        store.cleanupAbandoned(days).catch((error) => console.error(error));
      }
    }
    return store;
  }
  if (process.env.NODE_ENV === "production") return memoryStore();
  return sqliteStore(await getDb());
}

export function makeLock() {
  const active = new AsyncLocalStorage<boolean>();
  let chain: Promise<unknown> = Promise.resolve();
  return function lock<T>(fn: () => Promise<T>): Promise<T> {
    if (active.getStore()) return fn();
    const run = chain.then(() => active.run(true, fn));
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
