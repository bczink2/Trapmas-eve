import { getStore } from "@/lib/store";
import { handle, json, tokenFrom } from "@/lib/http";
import { artistView, paymentInstructions } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return handle(async () => {
    const store = await getStore();
    const submission = await store.getByResumeToken(tokenFrom(request));
    if (!submission) return json({ error: "Application not found." }, 404);
    const settings = await store.getSettings();
    return json({
      application: artistView(submission),
      instructions: paymentInstructions(settings, submission),
    });
  });
}
