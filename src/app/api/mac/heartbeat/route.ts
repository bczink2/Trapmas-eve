import { json } from "@/lib/http";
import { allowedTunnelUrl, recordHeartbeat } from "@/lib/mac/registry";
import { verifyRequest } from "@/lib/mac/sign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = Buffer.from(await request.arrayBuffer());
  const allowed = verifyRequest({
    secret: process.env.MAC_RECEIVER_SECRET || "",
    timestamp: request.headers.get("x-trapmas-timestamp"),
    method: "POST",
    path: "/api/mac/heartbeat",
    body,
    signature: request.headers.get("x-trapmas-signature"),
  });
  if (!allowed) return json({ error: "The heartbeat signature was rejected." }, 401);
  let payload: { url?: string };
  try {
    payload = JSON.parse(body.toString("utf8")) as { url?: string };
  } catch {
    return json({ error: "Send the tunnel URL as JSON." }, 400);
  }
  if (!payload.url || !allowedTunnelUrl(payload.url)) return json({ error: "That tunnel URL is not allowed." }, 400);
  recordHeartbeat(payload.url);
  return json({ ok: true });
}
