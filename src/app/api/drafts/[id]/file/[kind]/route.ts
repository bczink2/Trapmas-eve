import { readHeldFile } from "@/lib/drive/archive";
import { getStore } from "@/lib/store";
import { handle, inlineFile, json, tokenFrom } from "@/lib/http";
import { requireArtist } from "@/lib/payments/service";
import type { FileKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = new Set<FileKind>(["photo", "song1", "song2"]);

export function GET(request: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  return handle(async () => {
    const { id, kind } = await context.params;
    if (!KINDS.has(kind as FileKind)) return json({ error: "Unknown file." }, 404);
    const submission = await requireArtist(await getStore(), id, tokenFrom(request));
    const name =
      kind === "photo" ? submission.photoName : kind === "song1" ? submission.song1Name : submission.song2Name;
    const stored = await readHeldFile(submission, kind as "photo" | "song1" | "song2");
    if (!stored) return json({ error: "That file has not been uploaded." }, 404);
    return inlineFile(stored.data, stored.contentType, name || kind, "private");
  });
}
