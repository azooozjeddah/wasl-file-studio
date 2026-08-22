import { describe, expect, it } from "vitest";
import { hashFile, hexDigest } from "./hash-engine";

describe("file-integrity helpers", () => {
  it("formats binary digest bytes as padded lowercase hexadecimal", () => expect(hexDigest(Uint8Array.from([0, 15, 160, 255]).buffer)).toBe("000fa0ff"));
  it("calculates a SHA-256 digest for a local file", async () => expect(await hashFile(new File(["abc"], "sample.txt", { type: "text/plain" }), "SHA-256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
});
