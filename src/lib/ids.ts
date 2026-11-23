export function formatPublicId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Submission sequence must be a positive integer.");
  }
  return `TRAP-${String(sequence).padStart(3, "0")}`;
}

export function noteIncludesPublicId(note: string, publicId: string): boolean {
  return note.toUpperCase().includes(publicId.toUpperCase());
}

export function normalizeCashtag(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withDollar = trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
  return withDollar.replace(/\s+/g, "");
}

export function cashtagLooksValid(value: string): boolean {
  if (!value) return false;
  return /^\$[A-Za-z][A-Za-z0-9_]{0,19}$/.test(value);
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
