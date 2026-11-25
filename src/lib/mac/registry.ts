export const MAC_PAUSED = "Submissions are paused for a moment, please try again in a few minutes.";
export const MAC_UPLOAD_RETRY = "That file did not reach the Mac. Retry this file. Your application is still saved.";
export const MAC_ONLINE_MS = 3 * 60 * 1000;

type Beat = { url: string; at: number };
let beat: Beat | null = null;

export function resetHeartbeat(): void {
  beat = null;
}

export function recordHeartbeat(url: string, at = Date.now()): void {
  beat = { url, at };
}

export function macLink(now = Date.now()): { online: boolean; url: string; lastSeen: string | null } {
  if (!beat) return { online: false, url: "", lastSeen: null };
  const online = now - beat.at < MAC_ONLINE_MS && now >= beat.at;
  return { online, url: online ? beat.url : "", lastSeen: new Date(beat.at).toISOString() };
}

export function allowedTunnelUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "")) return false;
  if (url.protocol === "https:" && url.hostname.endsWith(".trycloudflare.com")) return true;
  return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
}
