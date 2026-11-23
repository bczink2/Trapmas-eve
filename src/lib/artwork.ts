export const DEFAULT_ARTWORK = {
  webp: "/artwork/trapmas-eve-flyer.webp",
  jpg: "/artwork/trapmas-eve-flyer.jpg",
  png: "/artwork/trapmas-eve-flyer.png",
  width: 1672,
  height: 941,
  alt: "HO HO HO! TRAPMAS EVE featuring RUBBERBAND OG — Artist Submissions Now Open. The flyer lists two MP3s, one photo, the application, and a $25 fee, and says SUBMIT YOUR MUSIC NOW. Activating this image jumps to the application form.",
};

export function artworkPageUrl(artworkKey: string): string {
  return artworkKey ? "/api/branding/artwork" : DEFAULT_ARTWORK.webp;
}

export function artworkSharePath(artworkKey: string): string {
  return artworkKey ? "/api/branding/artwork" : DEFAULT_ARTWORK.jpg;
}
