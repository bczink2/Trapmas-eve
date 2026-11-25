import http from "node:http";
import { verifyRequest } from "./sign.mjs";

const JSON_MAX = 2 * 1024 * 1024;

function fail(res, status, error, code = "invalid") {
  const body = JSON.stringify({ ok: false, error, code, status });
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function ok(res, result) {
  const body = JSON.stringify({ ok: true, result });
  res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("That upload is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function dispatch(library, op, input) {
  switch (op) {
    case "settings.get": return library.settings();
    case "settings.update": return library.updateSettings(input.patch || {}, Boolean(input.replace));
    case "submissions.create": return library.createSubmission(input.profile || {});
    case "submissions.get": return library.getSubmission(input.id);
    case "submissions.byPublicId": return library.getByPublicId(input.publicId);
    case "submissions.byResume": return library.getByResumeToken(input.token);
    case "submissions.saveProfile": return library.saveProfile(input.id, input.profile || {});
    case "submissions.acks": return library.saveAcknowledgments(input.id, input.acks || {});
    case "submissions.status": return library.setStatus(input.id, input.status, input.patch || null, input.event || {});
    case "submissions.patch": return library.patch(input.id, input.patch || {});
    case "submissions.list": return library.list(input || {});
    case "submissions.stats": return library.stats();
    case "submissions.delete":
      await library.deleteSubmission(input.id);
      return { ok: true };
    case "submissions.cleanup": return library.cleanupAbandoned(input.days);
    case "notes.list": return library.listNotes(input.id);
    case "notes.add":
      await library.addNote(input.id, input.body);
      return { ok: true };
    case "events.list": return library.listEvents(input.id);
    case "emails.log":
      await library.logEmail(input);
      return { ok: true };
    case "emails.list": return library.listEmails(input.id);
    case "webhooks.find": return library.findWebhook(input.provider, input.eventId);
    case "webhooks.insert":
      await library.insertWebhook(input);
      return { ok: true };
    default: {
      const error = new Error("Unknown request.");
      error.status = 404;
      error.code = "not_found";
      throw error;
    }
  }
}

export function createAgentServer(library, secret) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const reqPath = url.pathname;
      const method = req.method || "GET";
      const limit = reqPath === "/v1/files" || reqPath.startsWith("/v1/branding/") ? 20 * 1024 * 1024 : JSON_MAX;
      const body = method === "GET" || method === "HEAD" ? Buffer.alloc(0) : await readBody(req, limit);
      const allowed = verifyRequest({
        secret,
        timestamp: req.headers["x-trapmas-timestamp"],
        method,
        path: reqPath,
        body,
        signature: req.headers["x-trapmas-signature"],
      });
      if (!allowed) {
        fail(res, 401, "The Mac rejected this request.", "unauthorized");
        return;
      }
      if (method === "POST" && reqPath === "/v1/rpc") {
        const payload = JSON.parse(body.toString("utf8") || "{}");
        ok(res, await dispatch(library, payload.op, payload.input || {}));
        return;
      }
      if (method === "POST" && reqPath === "/v1/files") {
        ok(res, await library.saveUpload(String(req.headers["x-submission-id"] || ""), String(req.headers["x-kind"] || ""), String(req.headers["x-filename"] || "upload"), body));
        return;
      }
      const fileMatch = reqPath.match(/^\/v1\/files\/([^/]+)\/(photo|song1|song2)$/);
      if (method === "GET" && fileMatch) {
        const stored = await library.readUpload(decodeURIComponent(fileMatch[1]), fileMatch[2]);
        res.writeHead(200, { "Content-Type": stored.contentType, "Content-Length": stored.data.length, "X-Content-Type-Options": "nosniff" });
        res.end(stored.data);
        return;
      }
      const brandMatch = reqPath.match(/^\/v1\/branding\/(artwork|qr)$/);
      if (brandMatch && method === "POST") {
        ok(res, await library.saveBranding(brandMatch[1], body));
        return;
      }
      if (brandMatch && method === "DELETE") {
        ok(res, await library.clearBranding(brandMatch[1]));
        return;
      }
      if (brandMatch && method === "GET") {
        const stored = await library.readBranding(brandMatch[1]);
        if (!stored) {
          fail(res, 404, "That image is not on the Mac.", "not_found");
          return;
        }
        res.writeHead(200, { "Content-Type": stored.contentType, "Content-Length": stored.data.length });
        res.end(stored.data);
        return;
      }
      fail(res, 404, "Unknown request.", "not_found");
    } catch (error) {
      fail(res, Number(error.status) || 500, error instanceof Error ? error.message : "The Mac hit an error.", error.code || "mac");
    }
  });
}

export function listen(server, host, port) {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : port);
    });
  });
}
