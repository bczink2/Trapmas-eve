import { describe, expect, it } from "vitest";
import {
  checkSize,
  IMAGE_MAX_BYTES,
  isJpeg,
  isMp3,
  isPng,
  isWebp,
  MP3_MAX_BYTES,
  validateBrandingImage,
  validateUpload,
} from "@/lib/files/validate";

function mp3(size = 64): Buffer {
  const bytes = Buffer.alloc(size);
  bytes[0] = 0x49;
  bytes[1] = 0x44;
  bytes[2] = 0x33;
  bytes[3] = 0x03;
  return bytes;
}

function mpegFrame(): Buffer {
  return Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

function jpeg(): Buffer {
  const bytes = Buffer.alloc(16);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return bytes;
}

function png(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function webp(): Buffer {
  const bytes = Buffer.alloc(16);
  Buffer.from("RIFF").copy(bytes, 0);
  Buffer.from("WEBP").copy(bytes, 8);
  return bytes;
}

describe("file validation", () => {
  it("accepts a real MP3 by ID3 magic bytes and by frame sync", () => {
    expect(isMp3(mp3())).toBe(true);
    expect(isMp3(mpegFrame())).toBe(true);
    const result = validateUpload({
      kind: "song1",
      filename: "night.mp3",
      mime: "audio/mpeg",
      bytes: mp3(),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects WAV, executables, and MIME that does not match the bytes", () => {
    const wav = Buffer.from("RIFFxxxxWAVE");
    expect(
      validateUpload({ kind: "song1", filename: "song.mp3", mime: "audio/mpeg", bytes: wav }).ok,
    ).toBe(false);
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(
      validateUpload({ kind: "song2", filename: "song.mp3", mime: "audio/mp3", bytes: exe }).ok,
    ).toBe(false);
    expect(
      validateUpload({ kind: "photo", filename: "me.jpg", mime: "image/jpeg", bytes: mp3() }).ok,
    ).toBe(false);
    expect(
      validateUpload({ kind: "song1", filename: "song.mp3", mime: "audio/wav", bytes: mp3() }).ok,
    ).toBe(false);
  });

  it("accepts JPEG and PNG and rejects a renamed executable", () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isPng(png())).toBe(true);
    expect(validateUpload({ kind: "photo", filename: "me.jpg", mime: "image/jpeg", bytes: jpeg() }).ok).toBe(
      true,
    );
    expect(validateUpload({ kind: "photo", filename: "me.png", mime: "image/png", bytes: png() }).ok).toBe(
      true,
    );
    expect(
      validateUpload({
        kind: "photo",
        filename: "me.jpg",
        mime: "image/jpeg",
        bytes: Buffer.from([0x4d, 0x5a, 0x00, 0x00]),
      }).ok,
    ).toBe(false);
  });

  it("enforces 20 MB for songs and 10 MB for photos without trusting the client", () => {
    expect(checkSize("song1", MP3_MAX_BYTES)).toBeNull();
    expect(checkSize("song1", MP3_MAX_BYTES + 1)).toMatch(/20 MB/);
    expect(checkSize("photo", IMAGE_MAX_BYTES + 1)).toMatch(/10 MB/);
    expect(checkSize("photo", 0)).toMatch(/empty/);
    const tinyLimit = validateUpload(
      { kind: "song1", filename: "a.mp3", mime: "audio/mpeg", bytes: mp3(32) },
      { mp3: 8, image: 8 },
    );
    expect(tinyLimit.ok).toBe(false);
  });

  it("accepts a WebP flyer and rejects a mislabeled one", () => {
    expect(isWebp(webp())).toBe(true);
    expect(validateBrandingImage({ filename: "flyer.webp", mime: "image/webp", bytes: webp() }, 1024, "flyer").ok).toBe(
      true,
    );
    expect(validateBrandingImage({ filename: "flyer.webp", mime: "image/webp", bytes: jpeg() }, 1024, "flyer").ok).toBe(
      false,
    );
  });
});
