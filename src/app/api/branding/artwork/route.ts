import { readFile } from "fs/promises";
import path from "path";
import { DEFAULT_ARTWORK } from "@/lib/artwork";
import { readBranding } from "@/lib/files/branding";
import { getStore } from "@/lib/store";
import { handle, inlineFile } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return handle(async () => {
    const settings = await (await getStore()).getSettings();
    if (settings.artworkKey) {
      const stored = await readBranding(settings.artworkKey);
      if (stored) return inlineFile(stored.data, stored.contentType, "trapmas-eve-flyer", "public");
    }
    const file = path.join(process.cwd(), "public", DEFAULT_ARTWORK.jpg.replace(/^\//, ""));
    const data = await readFile(file);
    return inlineFile(data, "image/jpeg", "trapmas-eve-flyer.jpg", "public");
  });
}
