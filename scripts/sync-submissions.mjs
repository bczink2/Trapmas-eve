#!/usr/bin/env node
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { mainFolderName } from "../src/lib/sync-lib.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return process.argv[index + 1] || "";
}

export async function syncSubmissions(options) {
  const token = options.token || "";
  if (!token) throw new Error("Set ADMIN_EXPORT_TOKEN in the environment.");
  const base = String(options.base || "").replace(/\/$/, "");
  if (!base) throw new Error("Pass --base or set TRAPMAS_BASE_URL.");
  const since = options.since ? `?since=${encodeURIComponent(options.since)}` : "";
  const response = await fetch(`${base}/api/admin/export${since}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Export failed (${response.status}).`);
  }
  const folderName = options.folder
    ? mainFolderName(payload.eventName, payload.featuredArtist, options.folder)
    : payload.folderName;
  const root = path.join(options.outDir || process.cwd(), folderName);
  fs.mkdirSync(root, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  for (const submission of payload.submissions || []) {
    const dir = path.join(root, submission.folder);
    fs.mkdirSync(dir, { recursive: true });
    if (submission.savedToComputer || submission.fileHold === "computer") {
      skipped += 1;
      continue;
    }
    const infoPath = path.join(dir, "info.txt");
    const nextInfo = submission.info || "";
    if (!fs.existsSync(infoPath) || fs.readFileSync(infoPath, "utf8") !== nextInfo) {
      fs.writeFileSync(infoPath, nextInfo);
    } else {
      skipped += 1;
    }
    const proofs = {};
    let readyToConfirm = submission.fileHold === "drive";
    for (const slot of ["photo", "song1", "song2"]) {
      const file = submission.files?.[slot];
      if (!file?.url || !file.filename) continue;
      const dest = path.join(dir, path.basename(file.filename));
      let bytes = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
      if (!bytes || (file.sha256 && sha256(bytes) !== file.sha256)) {
        const fileUrl = /^https?:\/\//i.test(file.url)
          ? file.url
          : `${base}${file.url.startsWith("/") ? file.url : `/${file.url}`}`;
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Could not download ${submission.publicId} ${file.filename} (${fileResponse.status}).`);
        }
        bytes = Buffer.from(await fileResponse.arrayBuffer());
        if (file.sha256 && sha256(bytes) !== file.sha256) {
          throw new Error(`${submission.publicId} ${file.filename} checksum did not match. Left it in Drive.`);
        }
        const partial = `${dest}.partial`;
        fs.writeFileSync(partial, bytes);
        fs.renameSync(partial, dest);
        downloaded += 1;
      } else {
        skipped += 1;
      }
      proofs[slot] = sha256(bytes);
    }
    if (submission.files?.info?.sha256) {
      const infoHash = sha256(Buffer.from(nextInfo));
      if (infoHash !== submission.files.info.sha256) {
        throw new Error(`${submission.publicId} info.txt checksum did not match.`);
      }
      proofs.info = infoHash;
    }
    if (readyToConfirm && proofs.photo && proofs.song1 && proofs.song2) {
      const confirm = await fetch(`${base}/api/admin/export/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: submission.publicId, files: proofs }),
      });
      const body = await confirm.json().catch(() => ({}));
      if (!confirm.ok) throw new Error(body.error || `Could not clear Drive for ${submission.publicId}.`);
    }
  }
  return { root, downloaded, skipped, artists: (payload.submissions || []).length };
}

async function main() {
  const result = await syncSubmissions({
    token: process.env.ADMIN_EXPORT_TOKEN || "",
    base: arg("--base") || process.env.TRAPMAS_BASE_URL || "http://127.0.0.1:3847",
    outDir: arg("--out") || process.env.TRAPMAS_SYNC_DIR || process.cwd(),
    since: arg("--since") || process.env.TRAPMAS_SINCE || "",
    folder: arg("--folder") || process.env.TRAPMAS_FOLDER_NAME || "",
  });
  console.log(`Saved ${result.artists} paid artist folder(s) in ${result.root}`);
  console.log(`Downloaded ${result.downloaded} file(s). Skipped ${result.skipped} that were already there.`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
