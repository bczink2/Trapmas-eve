import fs from "fs";
import path from "path";
import { ApplyWizard } from "@/components/apply-wizard";
import { EventFlyer } from "@/components/event-flyer";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StickySubmitButton, SubmitMusicButton } from "@/components/submit-music-button";
import { getStore } from "@/lib/store";
import { artworkSharePath, DEFAULT_ARTWORK } from "@/lib/artwork";
import { toPublicSettings } from "@/lib/payments/service";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await (await getStore()).getSettings();
  const title = `${settings.eventName} — Artist submissions`;
  const description = settings.eventTagline;
  const image = artworkSharePath(settings.artworkKey);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
          width: DEFAULT_ARTWORK.width,
          height: DEFAULT_ARTWORK.height,
          alt: "HO HO HO! TRAPMAS EVE featuring RUBBERBAND OG — Artist Submissions Now Open",
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function HomePage() {
  const settings = toPublicSettings(await (await getStore()).getSettings());
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4">
        <EventFlyer
          settings={settings}
          artworkReady={
            !settings.artworkIsDefault ||
            fs.existsSync(path.join(process.cwd(), "public", "artwork", "trapmas-eve-flyer.jpg"))
          }
        />
        <div className="space-y-4">
          <h1 className="display max-w-4xl text-4xl leading-[0.95] text-primary sm:text-6xl">
            {settings.eventTagline}
          </h1>
          <p className="max-w-2xl text-xl text-foreground">{settings.eventSubheading}</p>
          <SubmitMusicButton />
        </div>
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["When", `${settings.eventDate} · ${settings.eventTime}`],
            ["Where", [settings.venueName, settings.venueAddress, settings.city].filter(Boolean).join(", ")],
            ["Featuring", settings.featuredArtist || "To be announced"],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs uppercase tracking-wide text-primary">{label}</p>
              <p className="mt-1">{value}</p>
            </article>
          ))}
        </section>
        <section className="max-w-3xl space-y-3 text-base leading-7">
          <p>{settings.eventDescription}</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Send two MP3s and one photo.</li>
            <li>Pay the fee on Cash App and put your TRAP number in the note.</li>
            <li>Our team confirms the payment, then you get the confirmation email.</li>
          </ol>
        </section>
        <section id="apply" className="scroll-mt-6 space-y-4 pb-8">
          <h2 className="display text-4xl">Application</h2>
          <ApplyWizard settings={settings} />
        </section>
      </main>
      <SiteFooter />
      <StickySubmitButton />
    </>
  );
}
