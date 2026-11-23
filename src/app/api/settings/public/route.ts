import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";
import { toPublicSettings } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return handle(async () => {
    const settings = await (await getStore()).getSettings();
    return json(toPublicSettings(settings));
  });
}
