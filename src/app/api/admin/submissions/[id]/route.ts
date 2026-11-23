import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { signedMediaPath } from "@/lib/files/storage";
import type { Submission } from "@/lib/types";
import { handle, json } from "@/lib/http";
import { removeSubmission } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mediaFor(submission: Submission, slot: "photo" | "song1" | "song2") {
  if (submission.fileHold === "computer") return "";
  const key = slot === "photo" ? submission.photoKey : slot === "song1" ? submission.song1Key : submission.song2Key;
  const driveId =
    slot === "photo" ? submission.photoDriveId : slot === "song1" ? submission.song1DriveId : submission.song2DriveId;
  if (!key && !driveId) return "";
  return signedMediaPath({ key, driveId });
}

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    const [notes, events, emails] = await Promise.all([
      store.listNotes(id),
      store.listEvents(id),
      store.listEmails(id),
    ]);
    const photoUrl = mediaFor(submission, "photo");
    const song1Url = mediaFor(submission, "song1");
    const song2Url = mediaFor(submission, "song2");
    return json({ submission, notes, events, emails, media: { photoUrl, song1Url, song2Url } });
  });
}

export function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    await removeSubmission(store, submission);
    return json({ ok: true });
  });
}
