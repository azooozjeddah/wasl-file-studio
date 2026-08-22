import { describe, expect, it } from "vitest";

describe("Resend credentials", () => {
  it("authenticates against the Resend domains endpoint", async () => {
    const key = process.env.RESEND_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    expect(response.ok).toBe(true);
  }, 20_000);
});
