export const DEFAULT_SENDER_NAME = "Dream 2 Reality";

export type EmailProviderName = "gmail" | "resend" | "log";

export function senderName(settingsName = ""): string {
  const fromEnv = process.env.EMAIL_FROM_NAME?.trim();
  if (fromEnv) return fromEnv;
  const fromSettings = settingsName.trim();
  if (fromSettings) return fromSettings;
  return DEFAULT_SENDER_NAME;
}

export function gmailAddress(): string {
  return (process.env.GMAIL_USER || "").trim();
}

export function gmailAppPassword(): string {
  return (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
}

export function gmailReady(): boolean {
  return Boolean(gmailAddress() && gmailAppPassword());
}

export function resendReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Gmail is the default. Resend is used only when EMAIL_PROVIDER=resend and a key is set. */
export function activeEmailProvider(): EmailProviderName {
  const choice = (process.env.EMAIL_PROVIDER || "gmail").trim().toLowerCase();
  if (choice === "resend") return resendReady() ? "resend" : "log";
  if (gmailReady()) return "gmail";
  if (choice === "gmail") return "log";
  return resendReady() ? "resend" : "log";
}

export function gmailFrom(settingsName = ""): { name: string; address: string } {
  return { name: senderName(settingsName), address: gmailAddress() };
}

export function resendFrom(settingsName = "", replyTo = ""): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const address = replyTo || "submissions@localhost";
  return `${senderName(settingsName)} <${address}>`;
}
