import { describe, expect, it } from "vitest";
import { parseProfile, type ProfileInput } from "@/lib/profile";

const complete: ProfileInput = {
  artistName: "Night Drive",
  legalName: "Alex Carter",
  email: "",
  phone: "(205) 555-0148",
  city: "Birmingham",
  state: "AL",
  instagram: "",
  genre: "Trap",
  bio: "",
  organizerNote: "",
  song1Title: "",
  song2Title: "",
};

describe("parseProfile", () => {
  it("requires real name, phone, stage name, genre, city, and state", () => {
    expect(parseProfile(complete).ok).toBe(true);
    expect(parseProfile({ ...complete, legalName: "A" }).ok).toBe(false);
    expect(parseProfile({ ...complete, phone: "555" }).ok).toBe(false);
    expect(parseProfile({ ...complete, artistName: "" }).ok).toBe(false);
    expect(parseProfile({ ...complete, genre: "" }).ok).toBe(false);
    expect(parseProfile({ ...complete, city: "" }).ok).toBe(false);
    expect(parseProfile({ ...complete, state: "A" }).ok).toBe(false);
  });

  it("lets email, socials, bio, notes, and song titles stay blank", () => {
    const parsed = parseProfile(complete);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.email).toBe("");
    expect(parsed.value.instagram).toBe("");
    expect(parsed.value.bio).toBe("");
    expect(parsed.value.song1Title).toBe("");
    expect(parsed.value.phone).toBe("(205) 555-0148");
    expect(parsed.value.city).toBe("Birmingham");
    expect(parsed.value.state).toBe("AL");
  });

  it("still checks an email when one is entered", () => {
    expect(parseProfile({ ...complete, email: "not-an-email" }).ok).toBe(false);
    const parsed = parseProfile({ ...complete, email: "Alex@Example.com" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.email).toBe("alex@example.com");
  });
});
