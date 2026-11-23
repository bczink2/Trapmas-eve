import { afterEach, describe, expect, it } from "vitest";
import { activeEmailProvider, DEFAULT_SENDER_NAME, gmailFrom, senderName } from "@/lib/email/provider";

const keys = ["EMAIL_PROVIDER", "EMAIL_FROM_NAME", "GMAIL_USER", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "EMAIL_FROM"];

afterEach(() => {
  for (const key of keys) delete process.env[key];
});

describe("email provider", () => {
  it("sends as Dream 2 Reality through Gmail unless a domain mailer is selected", () => {
    expect(senderName("")).toBe(DEFAULT_SENDER_NAME);
    expect(senderName("TRAPMAS EVE")).toBe("TRAPMAS EVE");
    process.env.EMAIL_FROM_NAME = "Dream 2 Reality";
    process.env.GMAIL_USER = "bc@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(gmailFrom("TRAPMAS EVE")).toEqual({ name: "Dream 2 Reality", address: "bc@gmail.com" });
    expect(activeEmailProvider()).toBe("gmail");
    process.env.RESEND_API_KEY = "re_test";
    expect(activeEmailProvider()).toBe("gmail");
    process.env.EMAIL_PROVIDER = "resend";
    expect(activeEmailProvider()).toBe("resend");
  });

  it("does not pretend mail is configured when Gmail and Resend are both empty", () => {
    expect(activeEmailProvider()).toBe("log");
  });
});
