"use client";

import { DEFAULT_ARTWORK } from "@/lib/artwork";
import type { PublicSettings } from "@/lib/types";
import { scrollToApplication } from "@/components/submit-music-button";

export function EventFlyer({
  settings,
  artworkReady = true,
}: {
  settings: PublicSettings;
  artworkReady?: boolean;
}) {
  if (!artworkReady && settings.artworkIsDefault) {
    return (
      <a
        href="#apply"
        onClick={scrollToApplication}
        className="block rounded-2xl bg-card p-6 ring-1 ring-primary/40"
      >
        <p className="display text-5xl leading-none text-primary">HO HO HO!</p>
        <p className="mt-2 text-xl">TRAPMAS EVE featuring {settings.featuredArtist || "Rubberband OG"}</p>
        <p className="mt-2 text-muted-foreground">Artist submissions are open. Two MP3s, one photo, the application, and a $25 fee.</p>
      </a>
    );
  }
  return (
    <a
      href="#apply"
      onClick={scrollToApplication}
      className="block overflow-hidden rounded-2xl ring-1 ring-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      {settings.artworkIsDefault ? (
        <picture>
          <source srcSet={DEFAULT_ARTWORK.webp} type="image/webp" />
          <img
            src={DEFAULT_ARTWORK.jpg}
            alt={DEFAULT_ARTWORK.alt}
            width={DEFAULT_ARTWORK.width}
            height={DEFAULT_ARTWORK.height}
            className="h-auto w-full"
          />
        </picture>
      ) : (
        <img src={settings.artworkUrl} alt={DEFAULT_ARTWORK.alt} className="h-auto w-full" />
      )}
    </a>
  );
}
