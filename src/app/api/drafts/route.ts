import { handle, json } from "@/lib/http";
import { artistView, paymentInstructions, startDraft } from "@/lib/payments/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ error: "Send the application details as JSON." }, 400);
    const store = await getStore();
    const created = await startDraft(store, body);
    const settings = await store.getSettings();
    return json(
      {
        resumeToken: created.resumeToken,
        application: artistView(created.submission),
        instructions: paymentInstructions(settings, created.submission),
      },
      201,
    );
  });
}
