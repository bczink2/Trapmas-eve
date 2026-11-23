const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeSegment(value, fallback = "artist") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  if (!cleaned) return fallback;
  if (RESERVED.test(cleaned)) return `${cleaned} file`.slice(0, 80);
  return cleaned;
}

export function mainFolderName(eventName, featuredArtist, override = "") {
  const custom = String(override || "").trim();
  if (custom) return sanitizeSegment(custom, "TRAPMAS EVE");
  const eventPart = sanitizeSegment(eventName || "TRAPMAS EVE", "TRAPMAS EVE");
  const featured = String(featuredArtist || "").trim();
  if (!featured) return eventPart;
  return sanitizeSegment(`${eventPart} - ${sanitizeSegment(featured, "artist")}`, eventPart);
}

export function assignFolders(submissions) {
  const sorted = [...submissions].sort((a, b) => {
    const created = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    if (created !== 0) return created;
    return String(a.publicId || "").localeCompare(String(b.publicId || ""));
  });
  const taken = new Set();
  const folders = new Map();
  for (const submission of sorted) {
    const base = sanitizeSegment(submission.artistName, "artist");
    let folder = base;
    if (taken.has(folder.toLowerCase())) {
      folder = sanitizeSegment(`${base} ${submission.publicId}`, `${base} ${submission.publicId}`);
    }
    if (taken.has(folder.toLowerCase())) {
      folder = sanitizeSegment(`${base} ${submission.publicId} ${String(submission.id || "").slice(0, 8)}`);
    }
    taken.add(folder.toLowerCase());
    folders.set(submission.publicId, folder);
  }
  return folders;
}

export function extensionFrom(filename, fallback) {
  const match = String(filename || "")
    .toLowerCase()
    .match(/\.([a-z0-9]{1,5})$/);
  const ext = match?.[1] === "jpeg" ? "jpg" : match?.[1];
  if (ext && ["mp3", "jpg", "png", "webp"].includes(ext)) return ext;
  return fallback;
}

function takeName(name, used) {
  const key = name.toLowerCase();
  if (!used.has(key)) {
    used.add(key);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  let next = `${stem} ${n}${ext}`;
  while (used.has(next.toLowerCase())) {
    n += 1;
    next = `${stem} ${n}${ext}`;
  }
  used.add(next.toLowerCase());
  return next;
}

export function bundleFileNames(submission) {
  const used = new Set();
  const photoExt = extensionFrom(submission.photoName, "jpg");
  return {
    photo: submission.photoKey ? takeName(`photo.${photoExt}`, used) : "",
    song1: submission.song1Key ? takeName(`${sanitizeSegment(submission.song1Title, "song 1")}.mp3`, used) : "",
    song2: submission.song2Key ? takeName(`${sanitizeSegment(submission.song2Title, "song 2")}.mp3`, used) : "",
  };
}

export function zipDownloadName(artistName, publicId) {
  return `${sanitizeSegment(artistName, "artist")} ${publicId}.zip`;
}

export function alreadyDownloaded(localBytes, remoteBytes) {
  return Number(localBytes) > 0 && Number(localBytes) === Number(remoteBytes);
}

function textValue(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function requiredLine(label, value) {
  return `${label}: ${textValue(value)}`;
}

function optionalLine(label, value) {
  const text = textValue(value);
  return text ? `${label}: ${text}` : "";
}

export function infoText(submission, event) {
  const dollars =
    Number.isFinite(submission.paidAmountCents) && submission.paidAmountCents > 0
      ? `$${(submission.paidAmountCents / 100).toFixed(2)}`
      : "";
  const lines = [
    event.eventName || "TRAPMAS EVE",
    event.featuredArtist ? `Featuring: ${event.featuredArtist}` : "",
    requiredLine("Submission", submission.publicId),
    requiredLine("Status", submission.status),
    requiredLine("Artist / stage name", submission.artistName),
    requiredLine("Legal name", submission.legalName),
    optionalLine("Email", submission.email),
    requiredLine("Phone", submission.phone),
    requiredLine("City", submission.city),
    requiredLine("State", submission.state),
    optionalLine("Instagram", submission.instagram),
    requiredLine("Genre", submission.genre),
    optionalLine("Song 1", submission.song1Title),
    optionalLine("Song 2", submission.song2Title),
    optionalLine("Photo file", submission.photoName),
    optionalLine("Bio", submission.bio),
    optionalLine("Note to BC", submission.organizerNote),
    optionalLine("Payer name or Cash App", submission.payerName),
    optionalLine("Payer $Cashtag", submission.payerCashtag),
    optionalLine("Payment note", submission.paymentNote),
    optionalLine("Payment claimed", submission.paymentClaimedAt),
    optionalLine("Marked paid", submission.paidAt),
    optionalLine("Marked paid by", submission.paidBy),
    dollars ? `Amount recorded: ${dollars}` : "",
    optionalLine("Payment reference", submission.paymentReference),
    optionalLine("Submitted", submission.createdAt),
  ];
  return `${lines.filter((line) => line !== "").join("\n")}\n`;
}
