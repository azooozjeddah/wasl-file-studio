import { describe, expect, it } from "vitest";
import { canBootstrapFirstAdmin } from "./devSetup";

describe("development first-admin policy", () => {
  it("allows bootstrap only in development before the dedicated local admin exists", () => {
    expect(canBootstrapFirstAdmin("development", false)).toBe(true);
    expect(canBootstrapFirstAdmin("development", true)).toBe(false);
    expect(canBootstrapFirstAdmin("production", false)).toBe(false);
    expect(canBootstrapFirstAdmin(undefined, false)).toBe(false);
  });
});
