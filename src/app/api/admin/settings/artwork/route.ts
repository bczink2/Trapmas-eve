import { requireAdmin } from "@/lib/auth/session";
import { clearBranding, saveBranding } from "@/lib/files/branding";
import { validateBrandingImage } from "@/lib/files/validate";
import { fileFrom, handle, json } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const file = await fileFrom(await request.formData());
    if (!file) return json({ error: "Choose a JPG, PNG, or WebP flyer." }, 400);
    const checked = validateBrandingImage(file, 8 * 1024 * 1024, "flyer");
    if (!checked.ok) return json({ error: checked.error }, 400);
    return json(
      await saveBranding(await getStore(), "artwork", {
        bytes: file.bytes,
        mime: checked.mime,
        extension: checked.extension,
      }),
    );
  });
}

export function DELETE() {
  return handle(async () => {
    await requireAdmin();
    return json(await clearBranding(await getStore(), "artwork"));
  });
}
