import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getStore } from "@/lib/store";
export async function LegalDocument({
  title,
  field,
}: {
  title: string;
  field: "termsText" | "privacyText" | "refundText";
}) {
  const settings = await (await getStore()).getSettings();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-primary">
          <Link href="/">Back to the application</Link>
        </p>
        <h1 className="display text-5xl">{title}</h1>
        {settings.legalIsDraft ? (
          <p className="rounded-xl border border-primary/50 bg-primary/10 p-3 text-sm">
            DRAFT — pending approval. This is not final policy and it is not legal advice.
          </p>
        ) : null}
        <article className="whitespace-pre-wrap text-base leading-7">{settings[field]}</article>
      </main>
      <SiteFooter />
    </>
  );
}
