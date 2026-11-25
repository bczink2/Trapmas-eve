import { googleDriveClient } from "@/lib/drive/google";
import { AppError } from "@/lib/errors";
import { deleteObject, getObject, putObject, type StoredFile } from "@/lib/files/storage";
import { isJpeg, isPng, isWebp } from "@/lib/files/validate";
import { macClearBranding, macDownload, macSaveBranding } from "@/lib/mac/client";
import type { Settings } from "@/lib/types";
import type { Store } from "@/lib/store";
import { mainFolderName } from "@/lib/sync-lib.mjs";

function contentType(bytes: Uint8Array): string {
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  if (isJpeg(bytes)) return "image/jpeg";
  return "application/octet-stream";
}

export async function readBranding(key: string): Promise<StoredFile | null> {
  if (!key) return null;
  if (key === "mac:artwork" || key === "mac:qr") {
    return macDownload(`/v1/branding/${key.slice(4)}`);
  }
  if (key.startsWith("drive:")) {
    const data = await googleDriveClient().download(key.slice("drive:".length));
    return { data, contentType: contentType(data) };
  }
  return getObject(key);
}

export async function saveBranding(
  store: Store,
  slot: "artwork" | "qr",
  file: { bytes: Buffer; mime: string; extension: string },
): Promise<Awaited<ReturnType<Store["updateSettings"]>>> {
  if (store.kind === "memory") {
    throw new AppError(503, "Google Drive is not connected yet, so this image cannot be saved.", "not_configured");
  }
  const settings = await store.getSettings();
  const field = slot === "artwork" ? "artworkKey" : "cashappQrKey";
  const previous = settings[field];
  let key = "";
  if (store.kind === "mac") {
    return (await macSaveBranding(slot, file.bytes, file.mime)) as Settings;
  }
  if (store.kind === "sheets") {
    const drive = googleDriveClient();
    const event = await drive.ensureFolder(
      process.env.GOOGLE_DRIVE_FOLDER_ID || "",
      mainFolderName(settings.eventName, settings.featuredArtist),
    );
    const branding = await drive.ensureFolder(event, "Branding");
    const uploaded = await drive.upload(branding, `${slot}${file.extension}`, file.mime, file.bytes);
    key = `drive:${uploaded.id}`;
  } else {
    key = `branding/${slot}${file.extension}`;
    await putObject(key, file.bytes, file.mime);
  }
  const updated = await store.updateSettings({ [field]: key });
  if (previous && previous !== key) {
    if (previous.startsWith("drive:")) await googleDriveClient().remove(previous.slice("drive:".length)).catch(() => undefined);
    else await deleteObject(previous).catch(() => undefined);
  }
  return updated;
}

export async function clearBranding(store: Store, slot: "artwork" | "qr") {
  const settings = await store.getSettings();
  const field = slot === "artwork" ? "artworkKey" : "cashappQrKey";
  const previous = settings[field];
  if (store.kind === "mac") return (await macClearBranding(slot)) as Settings;
  const updated = await store.updateSettings({ [field]: "" });
  if (previous.startsWith("drive:")) await googleDriveClient().remove(previous.slice("drive:".length)).catch(() => undefined);
  else if (previous) await deleteObject(previous).catch(() => undefined);
  return updated;
}
