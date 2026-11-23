import { receiveArtistUpload } from "@/lib/files/receive";
import { handle, json, tokenFrom } from "@/lib/http";
import { artistView, paymentInstructions, requireArtist } from "@/lib/payments/service";
import { getStore } from "@/lib/store";
import type { FileKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = new Set<FileKind>(["photo", "song1", "song2"]);

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params;
    const kind = new URL(request.url).searchParams.get("kind") || "";
    if (!KINDS.has(kind as FileKind)) return json({ error: "Choose song 1, song 2, or the photo." }, 400);
    const store = await getStore();
    const submission = await requireArtist(store, id, tokenFrom(request));
    const saved = await receiveArtistUpload(store, submission, kind as FileKind, request);
    const settings = await store.getSettings();
    return json({
      application: artistView(saved),
      instructions: paymentInstructions(settings, saved),
    });
  });
}
