import { describe, expect, it } from "vitest";
import { buildZip, readStoredZip } from "@/lib/files/zip";
import {
  alreadyDownloaded,
  assignFolders,
  bundleFileNames,
  infoText,
  mainFolderName,
  zipDownloadName,
} from "@/lib/sync-lib.mjs";

describe("sync folder names", () => {
  it("uses the event and featured artist for the main folder", () => {
    expect(mainFolderName("TRAPMAS EVE 2026", "Rubberband OG")).toBe(
      "TRAPMAS EVE 2026 - Rubberband OG",
    );
    expect(mainFolderName("TRAPMAS EVE 2026", "Rubberband OG", "Custom Night")).toBe("Custom Night");
  });

  it("appends the TRAP id only when stage names collide", () => {
    const folders = assignFolders([
      { publicId: "TRAP-002", artistName: "Night Drive", createdAt: "2026-11-02T00:00:00.000Z" },
      { publicId: "TRAP-001", artistName: "Night Drive", createdAt: "2026-11-01T00:00:00.000Z" },
      { publicId: "TRAP-003", artistName: "Solo", createdAt: "2026-11-03T00:00:00.000Z" },
    ]);
    expect(folders.get("TRAP-001")).toBe("Night Drive");
    expect(folders.get("TRAP-002")).toBe("Night Drive TRAP-002");
    expect(folders.get("TRAP-003")).toBe("Solo");
  });

  it("names songs from their titles and skips a file that is already the same size", () => {
    const names = bundleFileNames({
      photoKey: "p",
      photoName: "press.PNG",
      song1Key: "a",
      song1Title: "Eve / Night",
      song2Key: "b",
      song2Title: "After Midnight",
    });
    expect(names.photo).toBe("photo.png");
    expect(names.song1).toBe("Eve Night.mp3");
    expect(names.song2).toBe("After Midnight.mp3");
    expect(zipDownloadName("Night Drive", "TRAP-001")).toBe("Night Drive TRAP-001.zip");
    expect(alreadyDownloaded(120, 120)).toBe(true);
    expect(alreadyDownloaded(10, 120)).toBe(false);
    expect(alreadyDownloaded(0, 0)).toBe(false);
  });
});

describe("info.txt", () => {
  it("keeps required contact fields and omits blank optional ones", () => {
    const text = infoText(
      {
        publicId: "TRAP-009",
        status: "paid",
        artistName: "Night Drive",
        legalName: "Alex Carter",
        email: "",
        phone: "2055550148",
        city: "Birmingham",
        state: "AL",
        instagram: "",
        genre: "Trap",
        song1Title: "",
        song2Title: "",
        photoName: "",
        bio: "Line one\n\nLine two",
        organizerNote: "   ",
        payerName: "",
        payerCashtag: "",
        paymentNote: "",
        paymentClaimedAt: "",
        paidAt: "",
        paidBy: "",
        paidAmountCents: 0,
        paymentReference: "",
        createdAt: "",
      },
      { eventName: "TRAPMAS EVE", featuredArtist: "" },
    );
    expect(text).toContain("Phone: 2055550148");
    expect(text).toContain("City: Birmingham");
    expect(text).toContain("State: AL");
    expect(text).toContain("Genre: Trap");
    expect(text).toContain("Bio: Line one Line two");
    expect(text).not.toContain("Email:");
    expect(text).not.toContain("Instagram:");
    expect(text).not.toContain("Song 1:");
    expect(text).not.toContain("Note to BC:");
  });
});

describe("submission zip", () => {
  it("packs the photo, both songs, and info.txt", () => {
    const zip = buildZip([
      { name: "Eve.mp3", data: Buffer.from("song-one") },
      { name: "After Midnight.mp3", data: Buffer.from("song-two") },
      { name: "photo.jpg", data: Buffer.from("picture") },
      { name: "info.txt", data: Buffer.from("Submission: TRAP-001\n") },
    ]);
    const files = readStoredZip(zip);
    expect(files.get("Eve.mp3")?.toString()).toBe("song-one");
    expect(files.get("After Midnight.mp3")?.toString()).toBe("song-two");
    expect(files.get("photo.jpg")?.toString()).toBe("picture");
    expect(files.get("info.txt")?.toString()).toContain("TRAP-001");
  });
});
