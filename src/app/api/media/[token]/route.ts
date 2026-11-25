import { driveClientFromEnv } from "@/lib/drive/google";
import { getObject, verifyMediaToken } from "@/lib/files/storage";
import { handle, inlineFile, json } from "@/lib/http";
import { macDownload } from "@/lib/mac/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    const access = verifyMediaToken(decodeURIComponent(token));
    if (!access) return json({ error: "This link has expired." }, 401);
    const macFile = access.key.match(/^mac\/([^/]+)\/(photo|song1|song2)$/);
    if (macFile) {
      const stored = await macDownload(`/v1/files/${macFile[1]}/${macFile[2]}`);
      if (!stored) return json({ error: "File not found." }, 404);
      return inlineFile(stored.data, stored.contentType, macFile[2], "private");
    }
    if (access.key) {
      const stored = await getObject(access.key);
      if (stored) {
        const filename = access.key.split("/").pop() || "file";
        return inlineFile(stored.data, stored.contentType, filename, "private");
      }
    }
    if (access.driveId) {
      const drive = driveClientFromEnv();
      if (!drive) return json({ error: "Google Drive is not configured." }, 404);
      const data = await drive.download(access.driveId);
      return inlineFile(data, "application/octet-stream", "file", "private");
    }
    return json({ error: "File not found." }, 404);
  });
}
