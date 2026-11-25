import { defaultSettings } from "@/lib/defaults";
import { AppError } from "@/lib/errors";
import { macRpc } from "@/lib/mac/client";
import type { ProfileInput } from "@/lib/profile";
import type { Store } from "@/lib/store";
import type { Settings, Submission, SubmissionStatus } from "@/lib/types";

let cleanupStarted = false;

async function settings(): Promise<Settings> {
  try {
    const current = await macRpc<Settings | null>("settings.get");
    if (current) return current;
    return await macRpc<Settings>("settings.update", { patch: defaultSettings(), replace: true });
  } catch (error) {
    if (error instanceof AppError && (error.code === "mac_offline" || error.code === "not_configured")) return defaultSettings();
    throw error;
  }
}

export function macStore(): Store {
  const store: Store = {
    kind: "mac",
    getSettings: settings,
    updateSettings: (patch) => macRpc<Settings>("settings.update", { patch }),
    createSubmission: (profile: ProfileInput) => macRpc("submissions.create", { profile }),
    getSubmission: (id) => macRpc<Submission | null>("submissions.get", { id }),
    getByPublicId: (publicId) => macRpc<Submission | null>("submissions.byPublicId", { publicId }),
    getByResumeToken: (token) => macRpc<Submission | null>("submissions.byResume", { token }),
    saveProfile: (id, profile) => macRpc("submissions.saveProfile", { id, profile }),
    saveAcknowledgments: (id, acks) => macRpc("submissions.acks", { id, acks }),
    setStatus: (id, status: SubmissionStatus, patch, event) => macRpc("submissions.status", { id, status, patch, event }),
    patch: (id, patch) => macRpc("submissions.patch", { id, patch }),
    async recordUpload() {
      throw new AppError(502, "That file did not reach the Mac. Retry this file. Your application is still saved.", "mac_upload");
    },
    async ensurePendingFolder(submission) {
      return submission;
    },
    listSubmissions: (query) => macRpc("submissions.list", query),
    submissionStats: () => macRpc("submissions.stats"),
    listEvents: (id) => macRpc("events.list", { id }),
    listNotes: (id) => macRpc("notes.list", { id }),
    addNote: async (id, body) => {
      await macRpc("notes.add", { id, body });
    },
    findWebhook: (provider, eventId) => macRpc("webhooks.find", { provider, eventId }),
    insertWebhook: (input) => macRpc("webhooks.insert", input),
    logEmail: (input) => macRpc("emails.log", input),
    listEmails: (id) => macRpc("emails.list", { id }),
    deleteSubmission: (id) => macRpc("submissions.delete", { id }),
    cleanupAbandoned: (days) => macRpc("submissions.cleanup", { days }),
    transaction: (fn) => fn(),
  };
  if (!cleanupStarted) {
    cleanupStarted = true;
    const days = Number(process.env.DRAFT_TTL_DAYS ?? "14");
    if (Number.isFinite(days) && days > 0) store.cleanupAbandoned(days).catch(() => undefined);
  }
  return store;
}
