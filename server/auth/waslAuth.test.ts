import { describe, expect, it } from "vitest";
import { hashPasswordResetToken, hashWaslPassword, toWaslPublicUser, validateWaslPassword, verifyWaslPassword } from "./waslAuth";

describe("Wasl password helpers", () => {
  it("accepts only passwords suitable for a Wasl account", () => {
    expect(validateWaslPassword("short")).toBe(false);
    expect(validateWaslPassword("Wasl-secret-2026")).toBe(true);
  });

  it("hashes and verifies passwords without accepting an incorrect password", async () => {
    const hash = await hashWaslPassword("Wasl-secret-2026");
    expect(hash).toMatch(/^scrypt\$/);
    await expect(verifyWaslPassword("Wasl-secret-2026", hash)).resolves.toBe(true);
    await expect(verifyWaslPassword("different-password", hash)).resolves.toBe(false);
  });

  it("omits account internals from the public session payload", () => {
    const publicUser = toWaslPublicUser({ id: 4, openId: "wasl_private", name: "User", email: "user@example.com", loginMethod: "wasl_password", passwordHash: "secret", waslAccount: true, accountStatus: "active", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    expect(publicUser).toMatchObject({ id: 4, email: "user@example.com", role: "user" });
    expect(publicUser).not.toHaveProperty("passwordHash");
    expect(publicUser).not.toHaveProperty("openId");
  });

  it("derives a fixed-length digest for reset tokens instead of keeping the raw token", () => {
    const token = "safe-one-time-token-for-wasl";
    const digest = hashPasswordResetToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
    expect(hashPasswordResetToken(token)).toBe(digest);
  });
});
