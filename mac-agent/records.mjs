import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { artistFolderName, diskName, pendingFolder, safeJoin, sanitizeSegment } from "./folders.mjs";

const MP3_MAX = 20 * 1024 * 1024;
const PHOTO_MAX = 10 * 1024 * 1024;
const BRANDING_MAX = 8 * 1024 * 1024;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function publicId(sequence) {
  return `TRAP-${String(sequence).padStart(3, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function blank(partial) {
  return {
    id: "", publicId: "", resumeHash: "", status: "draft", artistName: "", legalName: "", email: "", phone: "",
    city: "", state: "", instagram: "", genre: "", bio: "", organizerNote: "", song1Title: "", song2Title: "",
    photoKey: "", photoName: "", photoBytes: 0, song1Key: "", song1Name: "", song1Bytes: 0, song2Key: "", song2Name: "", song2Bytes: 0,
    ackTerms: false, ackPrivacy: false, ackRefund: false, ackRights: false, ackPhoto: false, ackFee: false, ackedAt: "",
    paymentProvider: "", payerName: "", payerCashtag: "", paymentNote: "", paymentClaimedAt: "", paidAt: "", paidBy: "",
    paidAmountCents: 0, paymentReference: "", providerSessionId: "", refundedAt: "", refundedBy: "", refundNote: "",
    decisionEmailSentAt: "", confirmationEmailSentAt: "", pendingEmailSentAt: "", fileHold: "pending", driveFolderId: "",
    photoDriveId: "", song1DriveId: "", song2DriveId: "", infoDriveId: "", photoSha256: "", song1Sha256: "", song2Sha256: "",
    infoSha256: "", syncedAt: "", createdAt: "", updatedAt: "", ...partial,
  };
}

function textValue(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function infoText(submission, settings = {}) {
  const dollars = Number(submission.paidAmountCents) > 0 ? `$${(submission.paidAmountCents / 100).toFixed(2)}` : "";
  const row = (label, value, required = false) => {
    const text = textValue(value);
    if (!text && !required) return "";
    return `${label}: ${text}`;
  };
  return [
    settings.eventName || "TRAPMAS EVE",
    settings.featuredArtist ? `Featuring: ${settings.featuredArtist}` : "",
    row("Submission", submission.publicId, true),
    row("Status", submission.status, true),
    row("Artist / stage name", submission.artistName, true),
    row("Legal name", submission.legalName, true),
    row("Email", submission.email),
    row("Phone", submission.phone, true),
    row("City", submission.city, true),
    row("State", submission.state, true),
    row("Instagram", submission.instagram),
    row("Genre", submission.genre, true),
    row("Song 1", submission.song1Title),
    row("Song 1 file", submission.song1Name),
    row("Song 2", submission.song2Title),
    row("Song 2 file", submission.song2Name),
    row("Photo file", submission.photoName),
    row("Bio", submission.bio),
    row("Note to BC", submission.organizerNote),
    row("Payer name or Cash App", submission.payerName),
    row("Payer $Cashtag", submission.payerCashtag),
    row("Payment note", submission.paymentNote),
    row("Payment claimed", submission.paymentClaimedAt),
    row("Marked paid", submission.paidAt),
    row("Marked paid by", submission.paidBy),
    dollars ? `Amount recorded: ${dollars}` : "",
    row("Payment reference", submission.paymentReference),
    row("Submitted", submission.createdAt),
    row("Updated", submission.updatedAt),
  ].filter(Boolean).join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function photoExtension(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ".jpg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return ".png";
  if (bytes.length >= 12 && bytes.toString("ascii", 8, 12) === "WEBP") return ".webp";
  return "";
}

function looksLikeMp3(bytes) {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return [2, 3, 4].includes(bytes[3]);
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

function fail(status, error, code = "invalid") {
  const err = new Error(error);
  err.status = status;
  err.code = code;
  throw err;
}

export async function openLibrary(root) {
  const storageRoot = path.resolve(root);
  await fs.mkdir(storageRoot, { recursive: true });
  const dbFile = path.join(storageRoot, "records.json");
  const csvFile = path.join(storageRoot, "submissions.csv");
  const empty = () => ({ seq: 0, settings: null, submissions: [], events: [], notes: [], emails: [], webhooks: [] });

  async function readDb() {
    try {
      const parsed = JSON.parse(await fs.readFile(dbFile, "utf8"));
      return { ...empty(), ...parsed };
    } catch (error) {
      if (error && error.code === "ENOENT") return empty();
      throw error;
    }
  }

  async function writeCsv(db) {
    const header = ["publicId", "status", "artistName", "legalName", "email", "phone", "city", "state", "genre", "instagram", "song1Title", "song2Title", "createdAt", "paidAt", "paymentReference", "folder"];
    const lines = [header.join(",")];
    for (const row of db.submissions) {
      lines.push([row.publicId, row.status, row.artistName, row.legalName, row.email, row.phone, row.city, row.state, row.genre, row.instagram, row.song1Title, row.song2Title, row.createdAt, row.paidAt, row.paymentReference, row.driveFolderId].map(csvCell).join(","));
    }
    const tmp = `${csvFile}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${lines.join("\n")}\n`);
    await fs.rename(tmp, csvFile);
  }

  async function writeDb(db) {
    const tmp = `${dbFile}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db));
    await fs.rename(tmp, dbFile);
    await writeCsv(db);
  }

  function must(db, id) {
    const found = db.submissions.find((row) => row.id === id);
    if (!found) fail(404, "Submission not found.", "not_found");
    return found;
  }

  function replace(db, submission) {
    const index = db.submissions.findIndex((row) => row.id === submission.id);
    if (index < 0) db.submissions.push(submission);
    else db.submissions[index] = submission;
  }

  async function writeChecked(file, bytes) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const part = `${file}.${randomBytes(4).toString("hex")}.part`;
    await fs.writeFile(part, bytes);
    const hash = sha256(bytes);
    if (sha256(await fs.readFile(part)) !== hash) fail(500, "The saved file did not match its checksum.", "checksum");
    await fs.rename(part, file);
    if (sha256(await fs.readFile(file)) !== hash) fail(500, "The saved file did not match its checksum.", "checksum");
    return hash;
  }

  function parts(relative) {
    return String(relative || "").split(/[/\\]/).filter(Boolean);
  }

  async function findFile(submission, kind) {
    const folderParts = parts(submission.driveFolderId || pendingFolder(submission.publicId));
    const folder = safeJoin(storageRoot, ...folderParts);
    const entries = await fs.readdir(folder).catch(() => []);
    const name = kind === "photo" ? entries.find((entry) => entry.startsWith("photo.")) : diskName(kind);
    if (!name || !entries.includes(name)) fail(404, "File not found.", "not_found");
    return safeJoin(storageRoot, ...folderParts, name);
  }

  async function promote(db, submission) {
    const fromRel = pendingFolder(submission.publicId);
    const from = safeJoin(storageRoot, ...parts(fromRel));
    const names = new Set(["Pending", "branding"]);
    for (const entry of await fs.readdir(storageRoot, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory()) names.add(entry.name);
    }
    const folder = artistFolderName(submission.artistName, submission.publicId, names);
    const dest = safeJoin(storageRoot, folder);
    try {
      await fs.access(from);
      await fs.rename(from, dest);
    } catch (error) {
      if (error && error.code === "ENOENT") await fs.mkdir(dest, { recursive: true });
      else throw error;
    }
    const next = { ...submission, driveFolderId: folder, fileHold: "computer", updatedAt: nowIso() };
    for (const kind of ["photo", "song1", "song2"]) {
      if (!next[`${kind}Sha256`]) continue;
      const data = await fs.readFile(await findFile(next, kind));
      if (sha256(data) !== next[`${kind}Sha256`]) fail(500, "The saved file did not match its checksum.", "checksum");
    }
    const info = Buffer.from(infoText(next, db.settings || {}), "utf8");
    next.infoSha256 = await writeChecked(safeJoin(storageRoot, folder, "info.txt"), info);
    return next;
  }

  return {
    root: storageRoot,
    async settings() {
      return (await readDb()).settings;
    },
    async updateSettings(patch, replaceAll = false) {
      const db = await readDb();
      db.settings = replaceAll ? { ...patch, updatedAt: nowIso() } : { ...(db.settings || {}), ...patch, updatedAt: nowIso() };
      await writeDb(db);
      return db.settings;
    },
    async createSubmission(profile) {
      const db = await readDb();
      db.seq += 1;
      const id = randomUUID();
      const createdAt = nowIso();
      const resumeToken = randomBytes(32).toString("hex");
      const pub = publicId(db.seq);
      const submission = blank({
        ...profile,
        id,
        publicId: pub,
        resumeHash: sha256(Buffer.from(resumeToken)),
        status: "draft",
        fileHold: "pending",
        driveFolderId: pendingFolder(pub),
        createdAt,
        updatedAt: createdAt,
      });
      await fs.mkdir(safeJoin(storageRoot, "Pending", pub), { recursive: true });
      db.submissions.push(submission);
      db.events.push({ id: randomUUID(), submissionId: id, fromStatus: "", toStatus: "draft", actor: "artist", note: "Application started", createdAt });
      await writeDb(db);
      return { submission, resumeToken };
    },
    async getSubmission(id) {
      return (await readDb()).submissions.find((row) => row.id === id) || null;
    },
    async getByPublicId(value) {
      return (await readDb()).submissions.find((row) => row.publicId === value) || null;
    },
    async getByResumeToken(token) {
      if (!token) return null;
      const hash = sha256(Buffer.from(String(token)));
      return (await readDb()).submissions.find((row) => row.resumeHash === hash) || null;
    },
    async saveProfile(id, profile) {
      const db = await readDb();
      const next = { ...must(db, id), ...profile, id, updatedAt: nowIso() };
      replace(db, next);
      await writeDb(db);
      return next;
    },
    async saveAcknowledgments(id, acks) {
      const db = await readDb();
      const next = { ...must(db, id), ...acks, ackedAt: nowIso(), updatedAt: nowIso() };
      replace(db, next);
      await writeDb(db);
      return next;
    },
    async setStatus(id, status, patch, event) {
      const db = await readDb();
      let current = { ...must(db, id), ...(patch || {}), status, updatedAt: nowIso() };
      if (status === "paid" && current.fileHold !== "computer") current = await promote(db, current);
      replace(db, current);
      db.events.push({ id: randomUUID(), submissionId: id, fromStatus: event?.fromStatus || "", toStatus: status, actor: event?.actor || "", note: event?.note || "", createdAt: nowIso() });
      await writeDb(db);
      return current;
    },
    async patch(id, patch) {
      const db = await readDb();
      const next = { ...must(db, id), ...patch, id, updatedAt: nowIso() };
      replace(db, next);
      await writeDb(db);
      return next;
    },
    async list(query = {}) {
      let rows = (await readDb()).submissions.slice();
      const q = String(query.q || "").trim().toLowerCase();
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      if (q) {
        rows = rows.filter((row) => [row.publicId, row.artistName, row.legalName, row.email, row.phone, row.payerName, row.payerCashtag, row.paymentNote].join("\n").toLowerCase().includes(q));
      }
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const offset = Number(query.offset) || 0;
      const limit = Number(query.limit) || 25;
      return { rows: rows.slice(offset, offset + limit), total: rows.length };
    },
    async stats() {
      const rows = (await readDb()).submissions;
      const byStatus = {};
      let revenueCents = 0;
      let refundedCents = 0;
      for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1;
        if (row.paidAt && !row.refundedAt) revenueCents += Number(row.paidAmountCents) || 0;
        if (row.refundedAt) refundedCents += Number(row.paidAmountCents) || 0;
      }
      return { byStatus, total: rows.length, revenueCents, refundedCents };
    },
    async listEvents(id) {
      return (await readDb()).events.filter((row) => row.submissionId === id);
    },
    async listNotes(id) {
      return (await readDb()).notes.filter((row) => row.submissionId === id);
    },
    async addNote(id, body) {
      const db = await readDb();
      must(db, id);
      db.notes.push({ id: randomUUID(), submissionId: id, body: String(body || "").slice(0, 4000), createdAt: nowIso() });
      await writeDb(db);
    },
    async logEmail(input) {
      const db = await readDb();
      db.emails.push({ id: randomUUID(), submissionId: input.submissionId, template: input.template || "", toEmail: input.toEmail || "", subject: input.subject || "", status: input.status || "", detail: input.detail || "", createdAt: nowIso() });
      await writeDb(db);
    },
    async listEmails(id) {
      return (await readDb()).emails.filter((row) => row.submissionId === id);
    },
    async findWebhook(provider, eventId) {
      const found = (await readDb()).webhooks.find((row) => row.provider === provider && row.eventId === eventId);
      return found ? { result: found.result, submissionId: found.submissionId } : null;
    },
    async insertWebhook(input) {
      const db = await readDb();
      if (db.webhooks.some((row) => row.provider === input.provider && row.eventId === input.eventId)) {
        fail(409, "UNIQUE constraint failed: webhook_events", "23505");
      }
      db.webhooks.push({ id: randomUUID(), ...input, createdAt: nowIso() });
      await writeDb(db);
    },
    async deleteSubmission(id) {
      const db = await readDb();
      const current = must(db, id);
      if (current.driveFolderId) await fs.rm(safeJoin(storageRoot, ...parts(current.driveFolderId)), { recursive: true, force: true });
      for (const key of ["submissions", "events", "notes", "emails", "webhooks"]) {
        db[key] = db[key].filter((row) => (row.submissionId || row.id) !== id || (key !== "submissions" && row.submissionId !== id));
      }
      db.submissions = db.submissions.filter((row) => row.id !== id);
      await writeDb(db);
    },
    async cleanupAbandoned(days) {
      const db = await readDb();
      const cutoff = Date.now() - Number(days) * 86400000;
      let count = 0;
      for (const submission of db.submissions) {
        if (submission.status !== "draft" && submission.status !== "awaiting_payment") continue;
        if (Date.parse(submission.createdAt) > cutoff) continue;
        if (submission.driveFolderId) await fs.rm(safeJoin(storageRoot, ...parts(submission.driveFolderId)), { recursive: true, force: true }).catch(() => undefined);
        replace(db, { ...submission, status: "expired", driveFolderId: "", updatedAt: nowIso() });
        count += 1;
      }
      if (count) await writeDb(db);
      return count;
    },
    async saveUpload(id, kind, filename, bytes) {
      if (!["photo", "song1", "song2"].includes(kind)) fail(400, "Choose song 1, song 2, or the photo.", "invalid_file");
      const limit = kind === "photo" ? PHOTO_MAX : MP3_MAX;
      if (!bytes?.length || bytes.length > limit) fail(400, kind === "photo" ? "Photos must be 10 MB or smaller." : "Each song must be an MP3 of 20 MB or smaller.", "invalid_file");
      const db = await readDb();
      const current = must(db, id);
      if (!["draft", "awaiting_payment"].includes(current.status)) fail(409, "Files can no longer be replaced.", "locked");
      let extension = ".mp3";
      if (kind === "photo") {
        extension = photoExtension(bytes);
        if (!extension || extension === ".webp") fail(400, "The photo must be a JPG or PNG file.", "invalid_file");
      } else if (!looksLikeMp3(bytes)) fail(400, "That file is not a real MP3.", "invalid_file");
      const relative = current.driveFolderId || pendingFolder(current.publicId);
      const full = safeJoin(storageRoot, ...parts(relative), diskName(kind, extension));
      const hash = await writeChecked(full, bytes);
      const next = {
        ...current,
        driveFolderId: relative,
        [`${kind}Key`]: `mac/${id}/${kind}`,
        [`${kind}Name`]: sanitizeSegment(filename, diskName(kind, extension)).slice(0, 120),
        [`${kind}Bytes`]: bytes.length,
        [`${kind}Sha256`]: hash,
        updatedAt: nowIso(),
      };
      replace(db, next);
      await writeDb(db);
      return next;
    },
    async readUpload(id, kind) {
      const current = must(await readDb(), id);
      const file = await findFile(current, kind);
      const data = await fs.readFile(file);
      const expected = current[`${kind}Sha256`];
      if (expected && sha256(data) !== expected) fail(500, "The file on disk did not match its checksum.", "checksum");
      return { data, contentType: kind === "photo" ? (file.endsWith(".png") ? "image/png" : "image/jpeg") : "audio/mpeg", filename: path.basename(file) };
    },
    async saveBranding(slot, bytes) {
      if (!["artwork", "qr"].includes(slot)) fail(400, "Unknown image.");
      if (!bytes?.length || bytes.length > BRANDING_MAX) fail(400, "That image must be 8 MB or smaller.");
      const extension = photoExtension(bytes);
      if (!extension) fail(400, "Upload a real JPG, PNG, or WebP.");
      await writeChecked(safeJoin(storageRoot, "branding", `${slot}${extension}`), bytes);
      const db = await readDb();
      db.settings = { ...(db.settings || {}), [slot === "artwork" ? "artworkKey" : "cashappQrKey"]: `mac:${slot}`, updatedAt: nowIso() };
      await writeDb(db);
      return db.settings;
    },
    async readBranding(slot) {
      const entries = await fs.readdir(safeJoin(storageRoot, "branding")).catch(() => []);
      const name = entries.find((entry) => entry.startsWith(`${slot}.`));
      if (!name) return null;
      const data = await fs.readFile(safeJoin(storageRoot, "branding", name));
      const contentType = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
      return { data, contentType, filename: name };
    },
    async clearBranding(slot) {
      const db = await readDb();
      db.settings = { ...(db.settings || {}), [slot === "artwork" ? "artworkKey" : "cashappQrKey"]: "", updatedAt: nowIso() };
      const entries = await fs.readdir(safeJoin(storageRoot, "branding")).catch(() => []);
      for (const entry of entries) {
        if (entry.startsWith(`${slot}.`)) await fs.rm(safeJoin(storageRoot, "branding", entry), { force: true });
      }
      await writeDb(db);
      return db.settings;
    },
  };
}
