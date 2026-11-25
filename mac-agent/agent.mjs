import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openLibrary } from "./records.mjs";
import { createAgentServer, listen } from "./server.mjs";
import { signRequest } from "./sign.mjs";
import { ensureCloudflared, startTunnel } from "./tunnel.mjs";

const secret = process.env.MAC_RECEIVER_SECRET || "";
const site = (process.env.TRAPMAS_SITE_URL || "").replace(/\/$/, "");
const host = process.env.MAC_HOST || "127.0.0.1";
const port = Number(process.env.MAC_PORT || 4747);
const heartbeatMs = Number(process.env.MAC_HEARTBEAT_MS || 60_000);
const storageRoot = process.env.MAC_STORAGE_ROOT || path.join(os.homedir(), "Music", "TRAPMAS EVE 2026 - Rubberband OG");
const tunnelOff = process.env.MAC_TUNNEL === "off";
const binDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "bin");

if (!secret) {
  console.error("Set MAC_RECEIVER_SECRET before starting the Mac agent.");
  process.exit(1);
}
if (!site) {
  console.error("Set TRAPMAS_SITE_URL to the Render address, for example https://trapmas-eve-c2a2.onrender.com");
  process.exit(1);
}

let publicUrl = tunnelOff ? process.env.MAC_PUBLIC_URL || `http://${host}:${port}` : "";
let stopping = false;
const children = [];

function track(child) {
  children.push(child);
  child.on("exit", () => {
    const index = children.indexOf(child);
    if (index >= 0) children.splice(index, 1);
  });
  return child;
}

async function heartbeat() {
  if (!publicUrl) return;
  const body = Buffer.from(JSON.stringify({ url: publicUrl, at: Date.now() }));
  const timestamp = String(Date.now());
  const signature = signRequest({ secret, timestamp, method: "POST", path: "/api/mac/heartbeat", body });
  try {
    const response = await fetch(`${site}/api/mac/heartbeat`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Trapmas-Timestamp": timestamp,
        "X-Trapmas-Signature": signature,
      },
    });
    if (!response.ok) console.error(`Heartbeat was refused (${response.status}). ${(await response.text()).slice(0, 180)}`);
  } catch (error) {
    console.error(`Heartbeat did not reach the site. ${error instanceof Error ? error.message : ""}`);
  }
}

function keepAwake() {
  if (process.platform !== "darwin" || process.env.MAC_CAFFEINATE === "0") return;
  const child = track(spawn("caffeinate", ["-i"], { stdio: "ignore" }));
  child.on("exit", () => {
    if (!stopping) setTimeout(keepAwake, 2000);
  });
  console.log("Keeping the Mac awake with caffeinate -i. Closing the lid can still sleep it.");
}

async function superviseTunnel() {
  if (tunnelOff) return;
  try {
    const binary = await ensureCloudflared(binDir);
    const child = track(startTunnel(binary, port, (url) => {
      if (url && url !== publicUrl) {
        publicUrl = url;
        console.log(`Tunnel URL: ${publicUrl}`);
        void heartbeat();
      }
    }));
    child.on("exit", (code) => {
      console.error(`cloudflared stopped (${code ?? "signal"}). Starting it again.`);
      if (!stopping) setTimeout(() => void superviseTunnel(), 2000);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (!stopping) setTimeout(() => void superviseTunnel(), 10_000);
  }
}

const library = await openLibrary(storageRoot);
const server = createAgentServer(library, secret);
await listen(server, host, port);
console.log(`TRAPMAS receiver listening on http://${host}:${port}`);
console.log(`Saving files in ${storageRoot}`);
keepAwake();
await superviseTunnel();
if (publicUrl) await heartbeat();
const timer = setInterval(() => void heartbeat(), heartbeatMs);

function shutdown() {
  stopping = true;
  clearInterval(timer);
  for (const child of children) child.kill("SIGTERM");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
