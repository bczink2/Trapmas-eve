export type ProfileInput = {
  artistName: string;
  legalName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  instagram: string;
  genre: string;
  bio: string;
  organizerNote: string;
  song1Title: string;
  song2Title: string;
};

export type ProfileResult = { ok: true; value: ProfileInput } | { ok: false; error: string };

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function multiline(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

export function parseProfile(input: Partial<Record<keyof ProfileInput, unknown>>): ProfileResult {
  const value: ProfileInput = {
    artistName: clean(input.artistName, 80),
    legalName: clean(input.legalName, 120),
    email: clean(input.email, 160).toLowerCase(),
    phone: clean(input.phone, 40),
    city: clean(input.city, 80),
    state: clean(input.state, 40),
    instagram: clean(input.instagram, 80).replace(/^@/, ""),
    genre: clean(input.genre, 40),
    bio: multiline(input.bio, 1200),
    organizerNote: multiline(input.organizerNote, 600),
    song1Title: clean(input.song1Title, 120),
    song2Title: clean(input.song2Title, 120),
  };

  if (value.artistName.length < 2) return { ok: false, error: "Enter your artist name." };
  if (value.legalName.length < 2) return { ok: false, error: "Enter your legal name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    return { ok: false, error: "Enter a real email address." };
  }
  const digits = value.phone.replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "Enter a phone number with area code." };
  if (value.city.length < 2) return { ok: false, error: "Enter your city." };
  if (value.state.length < 2) return { ok: false, error: "Enter your state." };
  if (!value.genre) return { ok: false, error: "Choose a genre." };
  return { ok: true, value };
}

export function profileReadyForPayment(profile: ProfileInput): string | null {
  if (!profile.song1Title) return "Name the first song.";
  if (!profile.song2Title) return "Name the second song.";
  return null;
}
