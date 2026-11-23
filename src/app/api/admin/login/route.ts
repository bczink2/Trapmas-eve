import {
  adminPassword,
  clearLoginFailures,
  loginAllowed,
  passwordsMatch,
  recordLoginFailure,
} from "@/lib/auth/token";
import { setAdminCookie } from "@/lib/auth/session";
import { clientIp, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request);
    if (!loginAllowed(ip)) {
      return json({ error: "Too many tries. Wait a few minutes and try again." }, 429);
    }
    const expected = adminPassword();
    if (!expected) {
      return json({ error: "Set ADMIN_PASSWORD before signing in." }, 503);
    }
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    if (!body?.password || !passwordsMatch(body.password, expected)) {
      recordLoginFailure(ip);
      return json({ error: "That password is wrong." }, 401);
    }
    clearLoginFailures(ip);
    await setAdminCookie();
    return json({ ok: true });
  });
}
