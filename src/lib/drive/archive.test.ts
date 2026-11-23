import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db/index";
import type { Database } from "@/lib/db/sql";
import { getSubmission } from "@/lib/db/repo";
import { sqliteStore, type Store } from "@/lib/store";
import { archivePaidSubmission, confirmDriveDownload, sha256 } from "@/lib/drive/archive";
import { memoryDrive } from "@/lib/drive/types";
import { getObject } from "@/lib/files/storage";
import { markPaid, saveAcks, startDraft, storeArtistFile } from "@/lib/payments/service";
import type { ProfileInput } from "@/lib/profile";

const profile: ProfileInput = {
  artistName: "Night Drive",
  legalName: "Alex Carter",
  email: "alex@example.com",
  phone: "2055550148",
  city: "Greensboro",
  state: "AL",
  instagram: "",
  genre: "Trap",
  bio: "",
  organizerNote: "",
  song1Title: "Eve",
  song2Title: "After Midnight",
};

function mp3() {
  const bytes = Buffer.alloc(32);
  bytes[0] = 0x49;
  bytes[1] = 0x44;
  bytes[2] = 0x33;
  bytes[3] = 0x03;
  return bytes;
}

function jpeg() {
  const bytes = Buffer.alloc(16);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

describe("Google Drive holding area", () => {
  let db: Database;
  let store: Store;
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "trapmas-drive-"));
    process.env.LOCAL_UPLOAD_DIR = uploadDir;
    process.env.GOOGLE_DRIVE_FOLDER_ID = "root-folder";
    db = openDatabase(":memory:");
    store = sqliteStore(db);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
  });

  it("copies a paid submission to Drive, checks the bytes, then removes the disk copy", async () => {
    let { submission } = await startDraft(store, profile);
    submission = await storeArtistFile(store, submission, "song1", { filename: "eve.mp3", mime: "audio/mpeg", bytes: mp3() });
    submission = await storeArtistFile(store, submission, "song2", { filename: "midnight.mp3", mime: "audio/mpeg", bytes: mp3() });
    submission = await storeArtistFile(store, submission, "photo", { filename: "press.jpg", mime: "image/jpeg", bytes: jpeg() });
    submission = await saveAcks(store, submission, {
      ackTerms: true, ackPrivacy: true, ackRefund: true, ackRights: true, ackPhoto: true, ackFee: true,
    });
    const paid = await markPaid(store, submission.id, { actor: "admin", amountCents: 2500, reference: "cash" });
    const drive = memoryDrive();
    const result = await archivePaidSubmission(store, paid.submission, drive);
    expect(result.status).toBe("copied");
    const saved = await getSubmission(db, submission.id);
    expect(saved?.fileHold).toBe("drive");
    expect(await getObject(submission.photoKey)).toBeNull();
    const remote = await drive.download(saved!.photoDriveId);
    expect(sha256(remote)).toBe(saved?.photoSha256);

    await expect(
      confirmDriveDownload(store, saved!.publicId, { photo: "nope", song1: saved!.song1Sha256, song2: saved!.song2Sha256, info: saved!.infoSha256 }, drive),
    ).rejects.toThrow(/checksum/i);
    expect((await getSubmission(db, submission.id))?.fileHold).toBe("drive");

    const cleared = await confirmDriveDownload(
      store,
      saved!.publicId,
      {
        photo: saved!.photoSha256,
        song1: saved!.song1Sha256,
        song2: saved!.song2Sha256,
        info: saved!.infoSha256,
      },
      drive,
    );
    expect(cleared.status).toBe("deleted");
    expect((await getSubmission(db, submission.id))?.fileHold).toBe("computer");
    expect(drive.files.size).toBe(2);
  });
});
