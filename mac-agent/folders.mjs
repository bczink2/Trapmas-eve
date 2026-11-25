import path from "node:path";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const RESERVED = new Set(["pending", "branding"]);

export function sanitizeSegment(value, fallback = "artist") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[. ]+/g, "")
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  if (WINDOWS_RESERVED.test(cleaned)) return `${cleaned} file`.slice(0, 80);
  if (RESERVED.has(cleaned.toLowerCase())) return `${cleaned} artist`.slice(0, 80);
  return cleaned;
}

export function safeJoin(root, ...parts) {
  const base = path.resolve(root);
  const full = path.resolve(base, ...parts);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("That path leaves the TRAPMAS folder.");
  }
  for (const part of parts) {
    const text = String(part ?? "");
    if (!text || text === "." || text === ".." || text.includes("/") || text.includes("\\") || text.includes("\0")) {
      throw new Error("That folder name is not allowed.");
    }
  }
  return full;
}

export function pendingFolder(publicId) {
  if (!/^TRAP-\d{3,}$/.test(publicId)) throw new Error("Bad TRAP id.");
  return path.join("Pending", publicId);
}

export function artistFolderName(artistName, publicId, taken) {
  const used = new Set([...taken].map((name) => String(name).toLowerCase()));
  let folder = sanitizeSegment(artistName, "artist");
  if (used.has(folder.toLowerCase())) folder = sanitizeSegment(`${folder} ${publicId}`, publicId);
  if (used.has(folder.toLowerCase())) folder = sanitizeSegment(`${folder} ${publicId}`, publicId);
  return folder;
}

export function diskName(kind, extension = ".jpg") {
  if (kind === "song1") return "song1.mp3";
  if (kind === "song2") return "song2.mp3";
  if (kind === "info") return "info.txt";
  const ext = extension === ".jpeg" ? ".jpg" : extension;
  if (![".jpg", ".png", ".webp"].includes(ext)) throw new Error("Photo type is not allowed.");
  return `photo${ext}`;
}
