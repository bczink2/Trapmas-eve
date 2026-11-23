import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db/index";
import type { Database } from "@/lib/db/sql";
import { getSubmission } from "@/lib/db/repo";
import { sqliteStore, type Store } from "@/lib/store";
import { buildPaidExport, submissionBundle } from "@/lib/export";
import { buildZip, readStoredZip } from "@/lib/files/zip";
import { markPaid, saveAcks, startDraft, storeArtistFile } from "@/lib/payments/service";
import type { ProfileInput } from "@/lib/profile";

function profile(name: string, email: string): ProfileInput {
  return {
    artistName: name,
    legalName: `${name} Legal`,
    email,
    phone: "2055550148",
    city: "Greensboro",
    state: "AL",
    instagram: "artist",
    genre: "Trap",
    bio: "Bio",
    organizerNote: "Note",
    song1Title: "Eve",
    song2Title: "After Midnight",
  };
}

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

async function withFiles(store: Store, name: string, email: string) {
  let { submission } = await startDraft(store, profile(name, email));
  submission = await storeArtistFile(store, submission, "song1", {
    filename: "eve.mp3",
    mime: "audio/mpeg",
    bytes: mp3(),
  });
  submission = await storeArtistFile(store, submission, "song2", {
    filename: "midnight.mp3",
    mime: "audio/mpeg",
    bytes: mp3(),
  });
  submission = await storeArtistFile(store, submission, "photo", {
    filename: "press.jpg",
    mime: "image/jpeg",
    bytes: jpeg(),
  });
  submission = await saveAcks(store, submission, {
    ackTerms: true,
    ackPrivacy: true,
    ackRefund: true,
    ackRights: true,
    ackPhoto: true,
    ackFee: true,
  });
  return submission;
}

describe("paid export", () => {
  let db: Database;
  let store: Store;
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "trapmas-export-"));
    process.env.LOCAL_UPLOAD_DIR = uploadDir;
    delete process.env.SUPABASE_URL;
    db = openDatabase(":memory:");
    store = sqliteStore(db);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("lists paid artists with signed file urls and stable folders", async () => {
    const first = await withFiles(store, "Night Drive", "a@example.com");
    const second = await withFiles(store, "Night Drive", "b@example.com");
    await markPaid(store, first.id, { actor: "admin", amountCents: 2500, reference: "cash-1" });
    const exported = await buildPaidExport(store, null);
    expect(exported.folderName).toBe("TRAPMAS EVE 2026 - Rubberband OG");
    expect(exported.submissions).toHaveLength(1);
    expect(exported.submissions[0]?.publicId).toBe(first.publicId);
    expect(exported.submissions[0]?.files.song1?.filename).toBe("Eve.mp3");
    expect(exported.submissions[0]?.files.song2?.filename).toBe("After Midnight.mp3");
    expect(exported.submissions[0]?.files.photo?.filename).toBe("photo.jpg");
    expect(exported.submissions[0]?.files.song1?.url).toContain("/api/media/");
    expect(exported.submissions[0]?.info).toContain(first.publicId);
    expect(exported.roster.map((row) => row.folder)).toEqual(["Night Drive"]);
    expect(second.publicId).toBe("TRAP-002");

    const saved = await getSubmission(db, first.id);
    const bundle = await submissionBundle(store, saved!);
    const zip = readStoredZip(buildZip(bundle.files));
    expect(bundle.downloadName).toBe("Night Drive TRAP-001.zip");
    expect(zip.get("Eve.mp3")?.length).toBeGreaterThan(0);
    expect(zip.get("After Midnight.mp3")).toBeTruthy();
    expect(zip.get("photo.jpg")).toBeTruthy();
    expect(zip.get("info.txt")?.toString()).toContain("Night Drive");
  });
});
