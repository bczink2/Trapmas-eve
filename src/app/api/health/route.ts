import { activeEmailProvider } from "@/lib/email/provider";
import { driveConfigured } from "@/lib/drive/google";
import { json } from "@/lib/http";
import { macLink } from "@/lib/mac/registry";
import { usesMacStorage } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const mac = usesMacStorage();
  const link = macLink();
  const drive = !mac && driveConfigured();
  const production = process.env.NODE_ENV === "production";
  return json({
    ok: true,
    service: "trapmas-eve",
    database: mac ? "mac" : drive ? "google_sheets" : production ? "not_configured" : "sqlite",
    storage: mac ? "mac" : drive ? "google_drive" : production ? "none" : "local",
    mac: mac ? (link.online ? "online" : "offline") : "off",
    macLastSeen: mac ? link.lastSeen : null,
    drive: drive ? "configured" : "off",
    email: activeEmailProvider() === "log" ? "not_configured" : activeEmailProvider(),
    payment: "cashapp_manual",
    persistentDisk: false,
  });
}
