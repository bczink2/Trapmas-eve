import { createHash } from "crypto";
import { googleDriveClient, uploadResumable } from "@/lib/drive/google";
import { AppError } from "@/lib/errors";
import { concatChunks, prefixThenRest, splitPrefix } from "@/lib/files/stream";
import { checkSize, safeFilename, validateUploadHeader } from "@/lib/files/validate";
import { storeArtistFile } from "@/lib/payments/service";
import type { Store } from "@/lib/store";
import type { FileKind, Submission } from "@/lib/types";

export async function receiveArtistUpload(
  store: Store,
  submission: Submission,
  kind: FileKind,
  request: Request,
): Promise<Submission> {
  if (store.kind === "memory") {
    throw new AppError(503, "Google Drive is not connected yet, so files cannot be uploaded.", "not_configured");
  }
  const length = Number(request.headers.get("content-length") || "");
  const sizeError = checkSize(kind, length);
  if (sizeError) throw new AppError(400, sizeError, "invalid_file");
  if (!request.body) throw new AppError(400, "Attach the file and try again.", "invalid_file");
  const filename = safeFilename(request.headers.get("x-filename") || "upload");
  const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
  const { prefix, rest } = await splitPrefix(request.body, 16);
  const checked = validateUploadHeader({ kind, filename, mime, prefix });
  if (!checked.ok) {
    await rest.cancel().catch(() => undefined);
    throw new AppError(400, checked.error, "invalid_file");
  }

  if (store.kind !== "sheets") {
    const chunks: Uint8Array[] = [prefix];
    const reader = rest.getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
    }
    return storeArtistFile(store, submission, kind, {
      filename,
      mime: checked.mime,
      bytes: Buffer.from(concatChunks(chunks)),
    });
  }

  const placed = await store.ensurePendingFolder(submission);
  const hash = createHash("sha256");
  const body = prefixThenRest(prefix, rest, (chunk) => {
    hash.update(chunk);
  });
  let uploaded: { id: string };
  try {
    uploaded = await uploadResumable({
      folderId: placed.driveFolderId,
      name: `${kind}${checked.extension}`,
      mime: checked.mime,
      size: length,
      body,
    });
  } catch (error) {
    await rest.cancel().catch(() => undefined);
    throw error instanceof AppError
      ? error
      : new AppError(502, error instanceof Error ? error.message : "Google Drive upload failed.", "drive");
  }
  try {
    return await store.recordUpload(placed.id, kind, {
      key: "",
      name: filename,
      bytes: length,
      driveId: uploaded.id,
      sha256: hash.digest("hex"),
      folderId: placed.driveFolderId,
    });
  } catch (error) {
    await googleDriveClient().remove(uploaded.id).catch(() => undefined);
    throw error;
  }
}
