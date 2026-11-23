import { readBranding } from "@/lib/files/branding";
import { getStore } from "@/lib/store";
import { handle, inlineFile, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return handle(async () => {
    const settings = await (await getStore()).getSettings();
    if (!settings.cashappQrKey) return json({ error: "No Cash App QR has been uploaded." }, 404);
    const stored = await readBranding(settings.cashappQrKey);
    if (!stored) return json({ error: "The Cash App QR file is missing." }, 404);
    return inlineFile(stored.data, stored.contentType, "cashapp-qr", "public");
  });
}
