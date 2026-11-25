import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RELEASE_API = "https://api.github.com/repos/cloudflare/cloudflared/releases/latest";
const ASSET = "cloudflared-darwin-arm64.tgz";

export function parseTunnelUrl(text) {
  const match = String(text).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return match ? match[0].replace(/\/$/, "") : "";
}

export function parseChecksumLine(checksums, filename) {
  for (const line of String(checksums).split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(\S+)$/i);
    if (match && match[2] === filename) return match[1].toLowerCase();
  }
  return "";
}

export async function ensureCloudflared(binDir, fetchImpl = fetch) {
  const binary = path.join(binDir, "cloudflared");
  if (fs.existsSync(binary)) return binary;
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("cloudflared is downloaded for Apple Silicon Macs. On this computer set MAC_TUNNEL=off.");
  }
  fs.mkdirSync(binDir, { recursive: true });
  const release = await fetchImpl(RELEASE_API, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "trapmas-mac-agent" },
  });
  if (!release.ok) throw new Error(`Could not read the cloudflared release (${release.status}).`);
  const body = await release.json();
  const assets = new Map((body.assets || []).map((asset) => [asset.name, asset.browser_download_url]));
  const tarballUrl = assets.get(ASSET);
  const checksumUrl = assets.get("checksums.txt");
  if (!tarballUrl || !checksumUrl) throw new Error("The cloudflared release is missing the Apple Silicon build.");
  const [tarballRes, checksumRes] = await Promise.all([fetchImpl(tarballUrl), fetchImpl(checksumUrl)]);
  if (!tarballRes.ok || !checksumRes.ok) throw new Error("Could not download cloudflared.");
  const packed = Buffer.from(await tarballRes.arrayBuffer());
  const expected = parseChecksumLine(await checksumRes.text(), ASSET);
  const actual = createHash("sha256").update(packed).digest("hex");
  if (!expected || expected !== actual) throw new Error("cloudflared download did not match Cloudflare's published checksum.");
  const archive = path.join(binDir, ASSET);
  fs.writeFileSync(archive, packed);
  await new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xzf", archive, "-C", binDir], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("Could not unpack cloudflared."))));
  });
  fs.rmSync(archive, { force: true });
  fs.chmodSync(binary, 0o755);
  return binary;
}

export function startTunnel(binary, port, onUrl) {
  const child = spawn(binary, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const watch = (chunk) => {
    const url = parseTunnelUrl(chunk.toString("utf8"));
    if (url) onUrl(url);
  };
  child.stdout.on("data", watch);
  child.stderr.on("data", watch);
  return child;
}
