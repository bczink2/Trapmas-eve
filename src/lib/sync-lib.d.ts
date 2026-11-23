declare module "@/lib/sync-lib.mjs" {
  export function sanitizeSegment(value: string, fallback?: string): string;
  export function mainFolderName(eventName: string, featuredArtist: string, override?: string): string;
  export function assignFolders(
    submissions: { publicId: string; artistName: string; createdAt?: string; id?: string }[],
  ): Map<string, string>;
  export function extensionFrom(filename: string, fallback: string): string;
  export function bundleFileNames(submission: {
    photoKey?: string;
    photoName?: string;
    song1Key?: string;
    song1Title?: string;
    song2Key?: string;
    song2Title?: string;
  }): { photo: string; song1: string; song2: string };
  export function zipDownloadName(artistName: string, publicId: string): string;
  export function alreadyDownloaded(localBytes: number, remoteBytes: number): boolean;
  export function infoText(
    submission: object,
    event: { eventName?: string; featuredArtist?: string },
  ): string;
}
