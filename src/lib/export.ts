import type { Store } from "@/lib/store";
import { formatUsd } from "@/lib/money";
import { signedMediaPath } from "@/lib/files/storage";
import {
  assignFolders,
  bundleFileNames,
  infoText,
  mainFolderName,
  zipDownloadName,
} from "@/lib/sync-lib.mjs";
import type { Settings, Submission } from "@/lib/types";

const URL_TTL_SECONDS = 60 * 60;

async function everySubmission(store: Store): Promise<Submission[]> {
  const rows: Submission[] = [];
  const limit = 200;
  for (let offset = 0; offset < 5000; offset += limit) {
    const batch = await store.listSubmissions({ limit, offset });
    rows.push(...batch.rows);
    if (batch.rows.length < limit) break;
  }
  return rows;
}

export function isPaidSubmission(submission: Submission): boolean {
  return Boolean(submission.paidAt) && !submission.refundedAt && submission.status !== "refunded";
}

export async function submissionBundle(store: Store, submission: Submission, settings?: Settings) {
  const current = settings ?? (await store.getSettings());
  const names = bundleFileNames({
    ...submission,
    photoKey: submission.photoKey || submission.photoDriveId,
    song1Key: submission.song1Key || submission.song1DriveId,
    song2Key: submission.song2Key || submission.song2DriveId,
  });
  const files: { name: string; data: Buffer }[] = [];
  const { readHeldFile } = await import("@/lib/drive/archive");
  const pairs: ["photo" | "song1" | "song2", string][] = [
    ["photo", names.photo],
    ["song1", names.song1],
    ["song2", names.song2],
  ];
  for (const [slot, name] of pairs) {
    if (!name) continue;
    const stored = await readHeldFile(submission, slot);
    if (stored) files.push({ name, data: stored.data });
  }
  files.push({
    name: "info.txt",
    data: Buffer.from(infoText(submission, current), "utf8"),
  });
  return {
    downloadName: zipDownloadName(submission.artistName, submission.publicId),
    files,
  };
}

function absoluteUrl(origin: string, url: string) {
  if (!origin || /^https?:\/\//i.test(url)) return url;
  return `${origin.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function buildPaidExport(store: Store, since: string | null, origin = "") {
  const settings = await store.getSettings();
  const paid = (await everySubmission(store)).filter(isPaidSubmission);
  const folders = assignFolders(paid);
  const sinceMs = since ? Date.parse(since) : null;
  const submissions = [];
  for (const submission of paid) {
    const updatedMs = Date.parse(submission.updatedAt);
    const changed = sinceMs == null || (Number.isFinite(updatedMs) && updatedMs >= sinceMs);
    if (!changed) continue;
    const names = bundleFileNames({
      ...submission,
      photoKey: submission.photoKey || submission.photoDriveId,
      song1Key: submission.song1Key || submission.song1DriveId,
      song2Key: submission.song2Key || submission.song2DriveId,
    });
    const file = (
      slot: "photo" | "song1" | "song2",
      filename: string,
      bytes: number,
      sha256: string,
    ) => {
      if (submission.fileHold === "computer" || !filename) return null;
      const key = slot === "photo" ? submission.photoKey : slot === "song1" ? submission.song1Key : submission.song2Key;
      const driveId =
        slot === "photo" ? submission.photoDriveId : slot === "song1" ? submission.song1DriveId : submission.song2DriveId;
      if (!key && !driveId) return null;
      return {
        url: absoluteUrl(origin, signedMediaPath({ key, driveId }, URL_TTL_SECONDS)),
        filename,
        bytes,
        sha256,
      };
    };
    submissions.push({
      id: submission.id,
      publicId: submission.publicId,
      artistName: submission.artistName,
      status: submission.status,
      fileHold: submission.fileHold,
      savedToComputer: submission.fileHold === "computer",
      folder: folders.get(submission.publicId),
      updatedAt: submission.updatedAt,
      paidAt: submission.paidAt,
      amount: formatUsd(submission.paidAmountCents),
      files: {
        photo: file("photo", names.photo, submission.photoBytes, submission.photoSha256),
        song1: file("song1", names.song1, submission.song1Bytes, submission.song1Sha256),
        song2: file("song2", names.song2, submission.song2Bytes, submission.song2Sha256),
        info: submission.infoSha256 ? { sha256: submission.infoSha256, filename: "info.txt" } : null,
      },
      info: infoText(submission, settings),
    });
  }
  return {
    folderName: mainFolderName(settings.eventName, settings.featuredArtist),
    eventName: settings.eventName,
    featuredArtist: settings.featuredArtist,
    urlTtlSeconds: URL_TTL_SECONDS,
    generatedAt: new Date().toISOString(),
    roster: paid.map((submission) => ({
      publicId: submission.publicId,
      artistName: submission.artistName,
      folder: folders.get(submission.publicId),
      createdAt: submission.createdAt,
    })),
    submissions,
  };
}
