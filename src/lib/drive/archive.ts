import { createHash } from "crypto";
import { driveClientFromEnv } from "@/lib/drive/google";
import type { DriveClient } from "@/lib/drive/types";
import { AppError } from "@/lib/errors";
import { deleteObject, getObject } from "@/lib/files/storage";
import type { Store } from "@/lib/store";
import { infoText, mainFolderName, assignFolders, bundleFileNames } from "@/lib/sync-lib.mjs";
import type { Submission } from "@/lib/types";

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

type Slot = "photo" | "song1" | "song2" | "info";

function slots(submission: Submission, info: Buffer, names: { photo: string; song1: string; song2: string }) {
  return [
    {
      slot: "photo" as const,
      name: names.photo,
      key: submission.photoKey,
      mime: submission.photoName.toLowerCase().endsWith(".png")
        ? "image/png"
        : submission.photoName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg",
    },
    { slot: "song1" as const, name: names.song1, key: submission.song1Key, mime: "audio/mpeg" },
    { slot: "song2" as const, name: names.song2, key: submission.song2Key, mime: "audio/mpeg" },
    { slot: "info" as const, name: "info.txt", key: "", mime: "text/plain", inline: info },
  ];
}

export async function archivePaidSubmission(
  store: Store,
  submission: Submission,
  drive: DriveClient | null = driveClientFromEnv(),
): Promise<{ status: "copied" | "skipped_unconfigured" | "already_off_disk" | "no_files" }> {
  if (submission.fileHold === "drive" || submission.fileHold === "computer") {
    return { status: "already_off_disk" };
  }
  if (submission.fileHold === "pending" && submission.photoDriveId) {
    if (!drive || !process.env.GOOGLE_DRIVE_FOLDER_ID) return { status: "skipped_unconfigured" };
    return promotePending(store, submission, drive);
  }
  if (!drive || !process.env.GOOGLE_DRIVE_FOLDER_ID) return { status: "skipped_unconfigured" };
  const settings = await store.getSettings();
  const paid = (await store.listSubmissions({ limit: 500, offset: 0 })).rows.filter(
    (row) => row.paidAt && !row.refundedAt,
  );
  if (!paid.some((row) => row.id === submission.id)) paid.push(submission);
  const folderName = assignFolders(paid).get(submission.publicId) || submission.artistName;
  const names = bundleFileNames({
    ...submission,
    photoKey: submission.photoKey || (submission.photoName ? "photo" : ""),
    song1Key: submission.song1Key || (submission.song1Title ? "song1" : ""),
    song2Key: submission.song2Key || (submission.song2Title ? "song2" : ""),
  });
  const info = Buffer.from(infoText(submission, settings), "utf8");
  const eventFolder = await drive.ensureFolder(
    process.env.GOOGLE_DRIVE_FOLDER_ID,
    mainFolderName(settings.eventName, settings.featuredArtist),
  );
  const artistFolder = await drive.ensureFolder(eventFolder, folderName);
  const stored: Record<Slot, { id: string; sha256: string }> = {
    photo: { id: "", sha256: "" },
    song1: { id: "", sha256: "" },
    song2: { id: "", sha256: "" },
    info: { id: "", sha256: "" },
  };
  for (const item of slots(submission, info, names)) {
    if (item.slot !== "info" && !item.key) continue;
    const data = item.inline || (await getObject(item.key))?.data;
    if (!data) continue;
    const hash = sha256(data);
    const uploaded = await drive.upload(artistFolder, item.name, item.mime, data);
    const back = await drive.download(uploaded.id);
    if (sha256(back) !== hash) {
      await drive.remove(uploaded.id).catch(() => undefined);
      throw new AppError(502, `Google Drive copy of ${item.name} did not match. Local file kept.`, "drive_mismatch");
    }
    stored[item.slot] = { id: uploaded.id, sha256: hash };
  }
  if (!stored.song1.id || !stored.song2.id || !stored.photo.id) {
    return { status: "no_files" };
  }
  for (const key of [submission.photoKey, submission.song1Key, submission.song2Key]) {
    if (key) await deleteObject(key).catch(() => undefined);
  }
  await store.patch(submission.id, {
    fileHold: "drive",
    driveFolderId: artistFolder,
    photoDriveId: stored.photo.id,
    song1DriveId: stored.song1.id,
    song2DriveId: stored.song2.id,
    infoDriveId: stored.info.id,
    photoSha256: stored.photo.sha256,
    song1Sha256: stored.song1.sha256,
    song2Sha256: stored.song2.sha256,
    infoSha256: stored.info.sha256,
  });
  return { status: "copied" };
}

async function promotePending(
  store: Store,
  submission: Submission,
  drive: DriveClient,
): Promise<{ status: "copied" | "no_files" }> {
  if (!submission.photoDriveId || !submission.song1DriveId || !submission.song2DriveId || !submission.driveFolderId) {
    return { status: "no_files" };
  }
  const settings = await store.getSettings();
  const paid = (await store.listSubmissions({ limit: 500, offset: 0 })).rows.filter(
    (row) => row.paidAt && !row.refundedAt,
  );
  if (!paid.some((row) => row.id === submission.id)) paid.push(submission);
  const folderName = assignFolders(paid).get(submission.publicId) || submission.artistName;
  const names = bundleFileNames({
    ...submission,
    photoKey: submission.photoKey || "photo",
    song1Key: submission.song1Key || "song1",
    song2Key: submission.song2Key || "song2",
  });
  const eventFolder = await drive.ensureFolder(
    process.env.GOOGLE_DRIVE_FOLDER_ID || "",
    mainFolderName(settings.eventName, settings.featuredArtist),
  );
  const artistFolder = await drive.ensureFolder(eventFolder, folderName);
  await drive.move(submission.photoDriveId, artistFolder, submission.driveFolderId, names.photo);
  await drive.move(submission.song1DriveId, artistFolder, submission.driveFolderId, names.song1);
  await drive.move(submission.song2DriveId, artistFolder, submission.driveFolderId, names.song2);
  const info = Buffer.from(infoText(submission, settings), "utf8");
  const uploaded = await drive.upload(artistFolder, "info.txt", "text/plain", info);
  await drive.remove(submission.driveFolderId).catch(() => undefined);
  await store.patch(submission.id, {
    fileHold: "drive",
    driveFolderId: artistFolder,
    infoDriveId: uploaded.id,
    infoSha256: sha256(info),
  });
  return { status: "copied" };
}

export async function readHeldFile(
  submission: Submission,
  slot: "photo" | "song1" | "song2",
  drive: DriveClient | null = driveClientFromEnv(),
): Promise<{ data: Buffer; contentType: string } | null> {
  const key = slot === "photo" ? submission.photoKey : slot === "song1" ? submission.song1Key : submission.song2Key;
  if (key.startsWith("mac/")) {
    const { macDownload } = await import("@/lib/mac/client");
    const stored = await macDownload(`/v1/files/${submission.id}/${slot}`);
    return stored;
  }
  if (submission.fileHold === "computer") return null;
  const driveId =
    slot === "photo" ? submission.photoDriveId : slot === "song1" ? submission.song1DriveId : submission.song2DriveId;
  if (key) {
    const local = await getObject(key);
    if (local) return local;
  }
  if (driveId && drive) {
    const data = await drive.download(driveId);
    const contentType = slot === "photo" ? "image/jpeg" : "audio/mpeg";
    return { data, contentType };
  }
  return null;
}

export async function confirmDriveDownload(
  store: Store,
  publicId: string,
  hashes: { photo?: string; song1?: string; song2?: string; info?: string },
  drive: DriveClient | null = driveClientFromEnv(),
): Promise<{ status: "deleted" | "already_saved" }> {
  const submission = await store.getByPublicId(publicId);
  if (!submission) throw new AppError(404, "Submission not found.", "not_found");
  if (submission.fileHold === "computer") return { status: "already_saved" };
  if (submission.fileHold !== "drive") {
    throw new AppError(409, "These files are not waiting in Google Drive.", "not_in_drive");
  }
  if (!drive) throw new AppError(503, "Google Drive is not configured.", "not_configured");
  const expected = {
    photo: submission.photoSha256,
    song1: submission.song1Sha256,
    song2: submission.song2Sha256,
    info: submission.infoSha256,
  };
  const ids = {
    photo: submission.photoDriveId,
    song1: submission.song1DriveId,
    song2: submission.song2DriveId,
    info: submission.infoDriveId,
  };
  for (const slot of ["photo", "song1", "song2", "info"] as const) {
    if (!ids[slot]) continue;
    if ((hashes[slot] || "").toLowerCase() !== expected[slot].toLowerCase()) {
      throw new AppError(409, `${slot} checksum does not match. Nothing was deleted from Drive.`, "checksum");
    }
    const remote = await drive.download(ids[slot]);
    if (sha256(remote) !== expected[slot]) {
      throw new AppError(409, `Drive copy of ${slot} failed verification. Nothing was deleted.`, "checksum");
    }
  }
  for (const slot of ["photo", "song1", "song2", "info"] as const) {
    if (ids[slot]) await drive.remove(ids[slot]);
  }
  await store.patch(submission.id, {
    fileHold: "computer",
    syncedAt: new Date().toISOString(),
    photoDriveId: "",
    song1DriveId: "",
    song2DriveId: "",
    infoDriveId: "",
  });
  return { status: "deleted" };
}
