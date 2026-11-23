import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { sendTemplateEmail } from "@/lib/email/send";
import { handle, json } from "@/lib/http";
import type { EmailTemplateName } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEMPLATES = new Set<EmailTemplateName>([
  "pending",
  "confirmation",
  "approved",
  "waitlist",
  "declined",
]);

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { template?: EmailTemplateName; message?: string } | null;
    if (!body?.template || !TEMPLATES.has(body.template)) {
      return json({ error: "Choose which email to resend." }, 400);
    }
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    const settings = await store.getSettings();
    const email = await sendTemplateEmail(store, {
      settings,
      submission,
      template: body.template,
      note: body.message || "",
    });
    return json(email);
  });
}
