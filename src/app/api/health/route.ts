import { activeEmailProvider } from "@/lib/email/provider";
import { driveConfigured } from "@/lib/drive/google";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const drive = driveConfigured();
  const production = process.env.NODE_ENV === "production";
  return json({
    ok: true,
    service: "trapmas-eve",
    database: drive ? "google_sheets" : production ? "not_configured" : "sqlite",
    storage: drive ? "google_drive" : production ? "none" : "local",
    drive: drive ? "configured" : "off",
    email: activeEmailProvider() === "log" ? "not_configured" : activeEmailProvider(),
    payment: "cashapp_manual",
    persistentDisk: false,
  });
}
