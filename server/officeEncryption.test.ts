import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { OFFICE_MAX_BYTES, processOfficeEncryption } from "./officeEncryption";

const password = "Wasl-Test-Password-2026";
const descriptors = {
  word: { extension: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", part: "word/document.xml", fixtureName: "wasl-office-word.docx" },
  excel: { extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", part: "xl/workbook.xml", fixtureName: "wasl-office-excel.xlsx" },
  powerpoint: { extension: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", part: "ppt/presentation.xml", fixtureName: "wasl-office-powerpoint.pptx" },
} as const;

async function fixture(kind: keyof typeof descriptors) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"/>");
  zip.file("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>");
  zip.file(descriptors[kind].part, `<fixture kind=\"${kind}\">Wasl Office Encryption 2026</fixture>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}

async function nativeFixture(kind: keyof typeof descriptors) {
  return readFile(join(process.cwd(), "server", "fixtures", "office", descriptors[kind].fixtureName));
}

async function sizedNativeFixture(kind: keyof typeof descriptors, targetBytes: number) {
  const source = await nativeFixture(kind);
  const archive = await JSZip.loadAsync(source);
  const createPackage = async (payloadBytes: number) => {
    archive.file("customXml/office-encryption-performance.bin", Buffer.alloc(payloadBytes, 0x5a), { compression: "STORE" });
    return Buffer.from(await archive.generateAsync({ type: "nodebuffer", compression: "STORE" }));
  };
  const oneBytePackage = await createPackage(1);
  const payloadBytes = targetBytes - (oneBytePackage.byteLength - 1);
  if (payloadBytes < 1) throw new Error("Office performance fixture target is below package overhead.");
  const result = await createPackage(payloadBytes);
  if (result.byteLength !== targetBytes) throw new Error("Unable to create an Office performance fixture at the requested raw-byte boundary.");
  return result;
}

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

describe("Office Encryption service", () => {
  for (const [kind, descriptor] of Object.entries(descriptors) as Array<[keyof typeof descriptors, (typeof descriptors)[keyof typeof descriptors]]>) {
    it(`round-trips ${kind.toUpperCase()} with a real Office-encryption container`, async () => {
      const original = await nativeFixture(kind);
      const originalHash = sha256(original);
      const protectedResult = await processOfficeEncryption({ operation: `protect-${kind}` as "protect-word" | "protect-excel" | "protect-powerpoint", fileName: `sample.${descriptor.extension}`, contentType: descriptor.mime, inputBase64: original.toString("base64"), password });
      const encrypted = Buffer.from(protectedResult.outputBase64, "base64");
      expect(encrypted.subarray(0, 8).toString("hex")).toBe("d0cf11e0a1b11ae1");
      expect(protectedResult.fileName).toBe(`sample-protected.${descriptor.extension}`);
      expect(protectedResult.contentType).toBe(descriptor.mime);
      expect(protectedResult.encrypted).toBe(true);
      expect(sha256(original)).toBe(originalHash);
      const unlockedResult = await processOfficeEncryption({ operation: `unlock-${kind}` as "unlock-word" | "unlock-excel" | "unlock-powerpoint", fileName: `sample-protected.${descriptor.extension}`, contentType: descriptor.mime, inputBase64: encrypted.toString("base64"), password });
      expect(sha256(Buffer.from(unlockedResult.outputBase64, "base64"))).toBe(sha256(original));
      expect(unlockedResult.fileName).toBe(`sample-protected-unlocked.${descriptor.extension}`);
      expect(unlockedResult.contentType).toBe(descriptor.mime);
      expect(unlockedResult.encrypted).toBe(false);
    });

    it(`rejects a wrong ${kind.toUpperCase()} password without leaking it`, async () => {
      const original = await nativeFixture(kind);
      const encrypted = await processOfficeEncryption({ operation: `protect-${kind}` as "protect-word" | "protect-excel" | "protect-powerpoint", fileName: `sample.${descriptor.extension}`, contentType: descriptor.mime, inputBase64: original.toString("base64"), password });
      await expect(processOfficeEncryption({ operation: `unlock-${kind}` as "unlock-word" | "unlock-excel" | "unlock-powerpoint", fileName: encrypted.fileName, contentType: descriptor.mime, inputBase64: encrypted.outputBase64, password: "Wrong-password-2026" })).rejects.toMatchObject({ message: expect.not.stringContaining("Wrong-password-2026") });
    });
  }

  it("rejects unsupported files, type mismatch, empty content, oversized inputs, and already encrypted protect input", async () => {
    const source = await fixture("word");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "sample.xlsx", contentType: descriptors.word.mime, inputBase64: source.toString("base64"), password })).rejects.toThrow("DOCX");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "sample.docx", contentType: "application/pdf", inputBase64: source.toString("base64"), password })).rejects.toThrow("MIME");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "empty.docx", contentType: descriptors.word.mime, inputBase64: "QUFBQQ==", password })).rejects.toThrow();
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "malformed.docx", contentType: descriptors.word.mime, inputBase64: "not-base64***", password })).rejects.toThrow("محتوى الملف المرسل غير صالح");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "empty-base64.docx", contentType: descriptors.word.mime, inputBase64: "", password })).rejects.toThrow("محتوى الملف المرسل غير صالح");
    const oversized = Buffer.alloc(OFFICE_MAX_BYTES + 1, 1).toString("base64");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "large.docx", contentType: descriptors.word.mime, inputBase64: oversized, password })).rejects.toThrow("10 MB");
    const encrypted = await processOfficeEncryption({ operation: "protect-word", fileName: "sample.docx", contentType: descriptors.word.mime, inputBase64: source.toString("base64"), password });
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: encrypted.fileName, contentType: descriptors.word.mime, inputBase64: encrypted.outputBase64, password })).rejects.toThrow("محمي بالفعل");
  });

  it("accepts an exact 10 MiB raw OOXML input while rejecting one raw byte above the limit", async () => {
    const exactLimit = await sizedNativeFixture("word", OFFICE_MAX_BYTES);
    expect(exactLimit.byteLength).toBe(OFFICE_MAX_BYTES);
    const protectedResult = await processOfficeEncryption({
      operation: "protect-word",
      fileName: "exact-limit.docx",
      contentType: descriptors.word.mime,
      inputBase64: exactLimit.toString("base64"),
      password,
    });
    expect(protectedResult.encrypted).toBe(true);
    const oneByteAboveLimit = Buffer.alloc(OFFICE_MAX_BYTES + 1, 1).toString("base64");
    await expect(processOfficeEncryption({
      operation: "protect-word",
      fileName: "above-limit.docx",
      contentType: descriptors.word.mime,
      inputBase64: oneByteAboveLimit,
      password,
    })).rejects.toThrow("10 MB");
  });

  it("allows the internal endpoint only for an authenticated administrator", async () => {
    const source = await fixture("word");
    const input = { operation: "protect-word" as const, fileName: "sample.docx", contentType: descriptors.word.mime, inputBase64: source.toString("base64"), password };
    const userContext = { user: { id: 2, openId: "member", email: "member@example.com", name: "Member", loginMethod: "wasl_password", passwordHash: null, waslAccount: true, accountStatus: "active", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const adminContext = { ...userContext, user: { ...userContext.user!, id: 1, openId: "admin", role: "admin" as const } } as TrpcContext;
    await expect(appRouter.createCaller(userContext).officeEncryption.process(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(adminContext).officeEncryption.process(input)).resolves.toMatchObject({ encrypted: true, fileName: "sample-protected.docx" });
  });

  it("round-trips deterministic Office packages at 1 MB, 5 MB, and the 10 MB boundary", async () => {
    const megabyte = 1024 * 1024;
    const targets = [1, 5, 10] as const;

    for (const sizeMb of targets) {
      // Agile encryption adds a container overhead. Keep a fixed raw-byte margin at the
      // 10 MiB upload boundary so the encrypted artifact can itself be uploaded to unlock.
      const targetBytes = sizeMb === 10 ? OFFICE_MAX_BYTES - 128 * 1024 : sizeMb * megabyte;
      const source = await sizedNativeFixture("word", targetBytes);
      expect(source.byteLength).toBeLessThanOrEqual(targetBytes);
      expect(source.byteLength).toBeGreaterThan(targetBytes - 128 * 1024);

      const startedAt = performance.now();
      const rssBefore = process.memoryUsage().rss;
      const protectedResult = await processOfficeEncryption({
        operation: "protect-word",
        fileName: `performance-${sizeMb}mb.docx`,
        contentType: descriptors.word.mime,
        inputBase64: source.toString("base64"),
        password,
      });
      const unlockedResult = await processOfficeEncryption({
        operation: "unlock-word",
        fileName: protectedResult.fileName,
        contentType: descriptors.word.mime,
        inputBase64: protectedResult.outputBase64,
        password,
      });
      const elapsedMs = performance.now() - startedAt;
      const rssAfter = process.memoryUsage().rss;

      expect(sha256(Buffer.from(unlockedResult.outputBase64, "base64"))).toBe(sha256(source));
      console.info(JSON.stringify({ suite: "office-encryption-performance", sizeMb, inputBytes: source.byteLength, elapsedMs: Number(elapsedMs.toFixed(1)), rssDeltaBytes: rssAfter - rssBefore }));
    }
  }, 15_000);
});
