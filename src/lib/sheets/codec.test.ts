import { describe, expect, it } from "vitest";
import { SUBMISSION_KEYS, submissionFromRow, submissionRow } from "@/lib/sheets/codec";
import type { Submission } from "@/lib/types";

describe("submission sheet rows", () => {
  it("keeps phone and city aligned when email and other optional fields are blank", () => {
    const submission = {
      id: "sub_1",
      publicId: "TRAP-001",
      artistName: "Night Drive",
      legalName: "Alex Carter",
      email: "",
      phone: "2055550148",
      city: "Birmingham",
      state: "AL",
      instagram: "",
      genre: "Trap",
      bio: "",
      organizerNote: "",
      song1Title: "",
      song2Title: "",
      status: "draft",
    } as Submission;
    const row = submissionRow(submission);
    expect(row).toHaveLength(SUBMISSION_KEYS.length);
    expect(row.every((cell) => cell !== "")).toBe(true);
    const read = submissionFromRow([...SUBMISSION_KEYS], row);
    expect(read?.email).toBe("");
    expect(read?.phone).toBe("2055550148");
    expect(read?.city).toBe("Birmingham");
    expect(read?.state).toBe("AL");
    expect(read?.genre).toBe("Trap");
    expect(read?.bio).toBe("");
    expect(read?.song1Title).toBe("");
  });
});
