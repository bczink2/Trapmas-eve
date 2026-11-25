import { afterEach, describe, expect, it } from "vitest";
import { MAC_ONLINE_MS, MAC_PAUSED, allowedTunnelUrl, macLink, recordHeartbeat, resetHeartbeat } from "@/lib/mac/registry";
import { signRequest, verifyRequest } from "@/lib/mac/sign";

describe("mac heartbeat", () => {
  afterEach(() => resetHeartbeat());

  it("is online for three minutes after a heartbeat, then pauses", () => {
    const now = 1_700_000_000_000;
    expect(macLink(now).online).toBe(false);
    recordHeartbeat("http://127.0.0.1:4747", now);
    expect(macLink(now).online).toBe(true);
    expect(macLink(now + MAC_ONLINE_MS - 1).url).toBe("http://127.0.0.1:4747");
    expect(macLink(now + MAC_ONLINE_MS).online).toBe(false);
    expect(MAC_PAUSED).toBe("Submissions are paused for a moment, please try again in a few minutes.");
  });

  it("allows only the quick tunnel and localhost", () => {
    expect(allowedTunnelUrl("https://lucky-name.trycloudflare.com")).toBe(true);
    expect(allowedTunnelUrl("http://127.0.0.1:4747")).toBe(true);
    expect(allowedTunnelUrl("https://example.com")).toBe(false);
  });

  it("rejects a signature that does not match the body", () => {
    const body = Buffer.from('{"url":"http://127.0.0.1:4747"}');
    const signature = signRequest({ secret: "test-secret", timestamp: "1700000000000", method: "POST", path: "/api/mac/heartbeat", body });
    expect(verifyRequest({ secret: "test-secret", timestamp: "1700000000000", method: "POST", path: "/api/mac/heartbeat", body, signature, now: 1700000000000 })).toBe(true);
    expect(verifyRequest({ secret: "test-secret", timestamp: "1700000000000", method: "POST", path: "/api/mac/heartbeat", body: Buffer.from("{}"), signature, now: 1700000000000 })).toBe(false);
  });
});
