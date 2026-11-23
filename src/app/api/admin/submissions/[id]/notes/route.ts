import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { body?: string } | null;
    const note = body?.body?.trim() || "";
    if (note.length < 1) return json({ error: "Write a note first." }, 400);
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    await store.addNote(id, note.slice(0, 2000));
    return json({ notes: await store.listNotes(id) });
  });
}
