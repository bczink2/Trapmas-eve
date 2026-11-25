import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { artistFolderName, pendingFolder, safeJoin, sanitizeSegment } from "../folders.mjs";
import { openLibrary } from "../records.mjs";
import { createAgentServer, listen } from "../server.mjs";
import { signRequest, verifyRequest } from "../sign.mjs";
import { parseChecksumLine, parseTunnelUrl } from "../tunnel.mjs";

function mp3() {
  const bytes = Buffer.alloc(32);
  bytes[0] = 0x49; bytes[1] = 0x44; bytes[2] = 0x33; bytes[3] = 0x04;
  return bytes;
}
function jpeg() {
  const bytes = Buffer.alloc(24);
  bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
  return bytes;
}

describe("signing and folders", () => {
  it("rejects a bad or stale signature", () => {
    const body = Buffer.from('{"op":"ping"}');
    const signature = signRequest({ secret: "test-secret", timestamp: "1700000000000", method: "POST", path: "/v1/rpc", body });
    assert.equal(verifyRequest({ secret: "test-secret", timestamp: "1700000000000", method: "POST", path: "/v1/rpc", body, signature, now: 1700000000000 }), true);
    assert.equal(verifyRequest({ secret: "other", timestamp: "1700000000000", method: "POST", path: "/v1/rpc", body, signature, now: 1700000000000 }), false);
    assert.equal(verifyRequest({ secret: "test-secret", timestamp: "1700000000000", method: "POST", path: "/v1/rpc", body, signature, now: 1700000000000 + 6 * 60 * 1000 }), false);
  });

  it("sanitizes artist folders and blocks path traversal", () => {
    assert.equal(sanitizeSegment("Night/Drive"), "Night Drive");
    assert.equal(sanitizeSegment("../etc"), "etc");
    assert.equal(sanitizeSegment("Pending"), "Pending artist");
    assert.equal(pendingFolder("TRAP-001"), path.join("Pending", "TRAP-001"));
    assert.throws(() => pendingFolder("../TRAP-001"));
    const root = path.join(os.tmpdir(), "trapmas-root");
    assert.throws(() => safeJoin(root, "..", "etc"));
    assert.equal(artistFolderName("Night Drive", "TRAP-002", new Set(["Night Drive"])), "Night Drive TRAP-002");
    assert.equal(parseTunnelUrl("https://lucky-name.trycloudflare.com"), "https://lucky-name.trycloudflare.com");
    assert.equal(parseChecksumLine("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  cloudflared-darwin-arm64.tgz", "cloudflared-darwin-arm64.tgz").length, 64);
  });
});

describe("library and receiver", () => {
  it("moves a paid submission onto the artist folder and writes csv", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "trapmas-mac-"));
    const library = await openLibrary(root);
    const created = await library.createSubmission({ artistName: "Night Drive", legalName: "Alex Carter", email: "", phone: "2055550148", city: "Birmingham", state: "AL", genre: "Trap" });
    let current = created.submission;
    current = await library.saveUpload(current.id, "song1", "../../eve.mp3", mp3());
    current = await library.saveUpload(current.id, "song2", "midnight.mp3", mp3());
    current = await library.saveUpload(current.id, "photo", "press.jpg", jpeg());
    const paid = await library.setStatus(current.id, "paid", { paidAt: new Date().toISOString(), paidAmountCents: 2500, paymentReference: "cash" }, { fromStatus: "payment_pending", actor: "admin", note: "paid" });
    assert.equal(paid.driveFolderId, "Night Drive");
    assert.equal(paid.fileHold, "computer");
    const info = await fs.readFile(path.join(root, "Night Drive", "info.txt"), "utf8");
    assert.match(info, /TRAP-001/);
    assert.match(info, /2055550148/);
    const csv = await fs.readFile(path.join(root, "submissions.csv"), "utf8");
    assert.match(csv, /TRAP-001,paid,Night Drive/);
    const server = createAgentServer(library, "test-secret");
    const port = await listen(server, "127.0.0.1", 0);
    const unsigned = await fetch(`http://127.0.0.1:${port}/v1/rpc`, { method: "POST", body: "{}" });
    assert.equal(unsigned.status, 401);
    server.close();
    await fs.rm(root, { recursive: true, force: true });
  });
});
