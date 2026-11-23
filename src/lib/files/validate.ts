import type { FileKind } from "@/lib/types";

export const MP3_MAX_BYTES = 20 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type UploadLimits = {
  mp3: number;
  image: number;
};

export const DEFAULT_LIMITS: UploadLimits = {
  mp3: MP3_MAX_BYTES,
  image: IMAGE_MAX_BYTES,
};

export type UploadInput = {
  kind: FileKind;
  filename: string;
  mime: string;
  bytes: Uint8Array;
};

export type UploadOk = {
  ok: true;
  mime: string;
  extension: string;
};

export type UploadResult = UploadOk | { ok: false; error: string };

const MP3_MIMES = new Set(["audio/mpeg", "audio/mp3"]);
const JPEG_MIMES = new Set(["image/jpeg", "image/jpg"]);
const PNG_MIMES = new Set(["image/png"]);

export function limitFor(kind: FileKind, limits: UploadLimits = DEFAULT_LIMITS): number {
  return kind === "photo" ? limits.image : limits.mp3;
}

export function checkSize(
  kind: FileKind,
  byteLength: number,
  limits: UploadLimits = DEFAULT_LIMITS,
): string | null {
  const limit = limitFor(kind, limits);
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    return "The file is empty.";
  }
  if (byteLength > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return kind === "photo"
      ? `Photos must be ${mb} MB or smaller.`
      : `Each song must be an MP3 of ${mb} MB or smaller.`;
  }
  return null;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/** True when the buffer starts with an ID3v2 tag or a MPEG Layer III frame. */
export function isMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const version = bytes[3];
    return version === 2 || version === 3 || version === 4;
  }
  if (bytes[0] !== 0xff || (bytes[1] & 0xe0) !== 0xe0) return false;
  const version = (bytes[1] >> 3) & 0x03;
  const layer = (bytes[1] >> 1) & 0x03;
  if (version === 0x01 || layer !== 0x01) return false;
  const bitrate = (bytes[2] >> 4) & 0x0f;
  const sampling = (bytes[2] >> 2) & 0x03;
  if (bitrate === 0 || bitrate === 0x0f || sampling === 0x03) return false;
  return true;
}

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

export function validateUpload(
  input: UploadInput,
  limits: UploadLimits = DEFAULT_LIMITS,
): UploadResult {
  const sizeError = checkSize(input.kind, input.bytes.byteLength, limits);
  if (sizeError) return { ok: false, error: sizeError };

  const mime = input.mime.trim().toLowerCase();
  const extension = extensionOf(input.filename);

  if (input.kind === "photo") {
    const jpeg = JPEG_MIMES.has(mime);
    const png = PNG_MIMES.has(mime);
    if (!jpeg && !png) {
      return { ok: false, error: "The photo must be a JPG or PNG file." };
    }
    if (jpeg && !isJpeg(input.bytes)) {
      return { ok: false, error: "That file is not a real JPEG. Upload a JPG or PNG photo." };
    }
    if (png && !isPng(input.bytes)) {
      return { ok: false, error: "That file is not a real PNG. Upload a JPG or PNG photo." };
    }
    if (extension && jpeg && extension !== ".jpg" && extension !== ".jpeg") {
      return { ok: false, error: "The photo filename must end in .jpg or .jpeg." };
    }
    if (extension && png && extension !== ".png") {
      return { ok: false, error: "The photo filename must end in .png." };
    }
    return { ok: true, mime: jpeg ? "image/jpeg" : "image/png", extension: extension || (jpeg ? ".jpg" : ".png") };
  }

  if (!MP3_MIMES.has(mime)) {
    return { ok: false, error: "Each song must be an MP3 (audio/mpeg)." };
  }
  if (!isMp3(input.bytes)) {
    return {
      ok: false,
      error: "That file is not a real MP3. Export the song as MP3 and try again.",
    };
  }
  if (extension && extension !== ".mp3") {
    return { ok: false, error: "Song filenames must end in .mp3." };
  }
  return { ok: true, mime: "audio/mpeg", extension: ".mp3" };
}

const WEBP_MIMES = new Set(["image/webp"]);

/** JPG, PNG, or WebP used for the flyer and the Cash App QR. */
export function validateBrandingImage(
  input: { filename: string; mime: string; bytes: Uint8Array },
  maxBytes: number,
  label: string,
): UploadResult {
  if (!input.bytes.byteLength) return { ok: false, error: `The ${label} file is empty.` };
  if (input.bytes.byteLength > maxBytes) {
    return { ok: false, error: `The ${label} must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.` };
  }
  const mime = input.mime.trim().toLowerCase();
  const jpeg = JPEG_MIMES.has(mime) && isJpeg(input.bytes);
  const png = PNG_MIMES.has(mime) && isPng(input.bytes);
  const webp = WEBP_MIMES.has(mime) && isWebp(input.bytes);
  if (!jpeg && !png && !webp) {
    return { ok: false, error: `Upload a real JPG, PNG, or WebP for the ${label}.` };
  }
  const extension = jpeg ? ".jpg" : png ? ".png" : ".webp";
  const normalized = jpeg ? "image/jpeg" : png ? "image/png" : "image/webp";
  return { ok: true, mime: normalized, extension };
}

/** Check the type from the filename, the declared MIME, and the first bytes. Size is checked separately. */
export function validateUploadHeader(
  input: { kind: FileKind; filename: string; mime: string; prefix: Uint8Array },
): UploadResult {
  const mime = input.mime.trim().toLowerCase();
  const extension = extensionOf(input.filename);
  if (input.kind === "photo") {
    const jpeg = (!mime || JPEG_MIMES.has(mime)) && isJpeg(input.prefix);
    const png = (!mime || PNG_MIMES.has(mime)) && isPng(input.prefix);
    if (JPEG_MIMES.has(mime) && !isJpeg(input.prefix)) {
      return { ok: false, error: "That file is not a real JPEG. Upload a JPG or PNG photo." };
    }
    if (PNG_MIMES.has(mime) && !isPng(input.prefix)) {
      return { ok: false, error: "That file is not a real PNG. Upload a JPG or PNG photo." };
    }
    if (!jpeg && !png) {
      return { ok: false, error: "The photo must be a JPG or PNG file." };
    }
    if (extension && jpeg && extension !== ".jpg" && extension !== ".jpeg") {
      return { ok: false, error: "The photo filename must end in .jpg or .jpeg." };
    }
    if (extension && png && extension !== ".png") {
      return { ok: false, error: "The photo filename must end in .png." };
    }
    return { ok: true, mime: jpeg ? "image/jpeg" : "image/png", extension: extension || (jpeg ? ".jpg" : ".png") };
  }
  if (mime && !MP3_MIMES.has(mime)) {
    return { ok: false, error: "Each song must be an MP3 (audio/mpeg)." };
  }
  if (!isMp3(input.prefix)) {
    return { ok: false, error: "That file is not a real MP3. Export the song as MP3 and try again." };
  }
  if (extension && extension !== ".mp3") {
    return { ok: false, error: "Song filenames must end in .mp3." };
  }
  return { ok: true, mime: "audio/mpeg", extension: ".mp3" };
}

export function safeFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? "upload").replace(/[^\w.\- ]+/g, "").trim();
  return base.slice(0, 120) || "upload";
}
