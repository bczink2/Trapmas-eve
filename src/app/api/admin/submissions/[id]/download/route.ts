import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { submissionBundle } from "@/lib/export";
import { buildZip } from "@/lib/files/zip";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const store = await getStore();
    const submission = await store.getSubmission(id);
    if (!submission) return json({ error: "Submission not found." }, 404);
    if (submission.fileHold === "computer") {
      return json({ error: "Saved to computer. The server copy is already gone." }, 409);
    }
    const bundle = await submissionBundle(store, submission, await store.getSettings());
    const zip = buildZip(bundle.files);
    const ascii = bundle.downloadName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.length),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(bundle.downloadName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
