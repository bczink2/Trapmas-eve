import { driveClientFromEnv } from "@/lib/drive/google";
import { getObject, verifyMediaToken } from "@/lib/files/storage";
import { handle, inlineFile, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    const access = verifyMediaToken(decodeURIComponent(token));
    if (!access) return json({ error: "This link has expired." }, 401);
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
