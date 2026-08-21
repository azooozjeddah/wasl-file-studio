import { describe, expect, it } from "vitest";
import { shouldExposeTrpcStack } from "./trpc";

describe("tRPC production error exposure", () => {
  it("exposes stack information only in development and test", () => {
    expect(shouldExposeTrpcStack("development")).toBe(true);
    expect(shouldExposeTrpcStack("test")).toBe(true);
    expect(shouldExposeTrpcStack("production")).toBe(false);
    expect(shouldExposeTrpcStack(undefined)).toBe(false);
  });
});
