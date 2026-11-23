import { ApplyWizard } from "@/components/apply-wizard";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getStore } from "@/lib/store";
import { toPublicSettings } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

export default async function ResumePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = toPublicSettings(await (await getStore()).getSettings());
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="display mb-4 text-4xl">Resume your application</h1>
        <ApplyWizard settings={settings} initialToken={token} />
      </main>
      <SiteFooter />
    </>
  );
}
