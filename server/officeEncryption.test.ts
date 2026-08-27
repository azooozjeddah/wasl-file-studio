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

type OfficeKind = keyof typeof descriptors;

async function nativeFixture(kind: OfficeKind) {
  return readFile(join(process.cwd(), "server", "fixtures", "office", descriptors[kind].fixtureName));
}

async function zipFixture(kind: OfficeKind) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"/>");
  zip.file("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>");
  zip.file(descriptors[kind].part, `<fixture kind=\"${kind}\">Wasl Office Encryption</fixture>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}

async function sizedNativeFixture(kind: OfficeKind, targetBytes: number) {
  const archive = await JSZip.loadAsync(await nativeFixture(kind));
  const makePackage = async (payloadBytes: number) => {
    archive.file("customXml/office-encryption-performance.bin", Buffer.alloc(payloadBytes, 0x5a), { compression: "STORE" });
    return Buffer.from(await archive.generateAsync({ type: "nodebuffer", compression: "STORE" }));
  };
  const oneBytePackage = await makePackage(1);
  const payloadBytes = targetBytes - (oneBytePackage.byteLength - 1);
  if (payloadBytes < 1) throw new Error("Fixture target is below package overhead.");
  const result = await makePackage(payloadBytes);
  if (result.byteLength !== targetBytes) throw new Error("Unable to create an exact-size Office package.");
  return result;
}

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const operation = (action: "protect" | "unlock", kind: OfficeKind) => `${action}-${kind}` as const;

function context(role: "admin" | "user" | null): TrpcContext {
  return {
    user: role ? {
      id: role === "admin" ? 1 : 2,
      openId: role,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "wasl_password",
      passwordHash: null,
      waslAccount: true,
      accountStatus: "active",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Office Encryption internal service", () => {
  for (const [kind, descriptor] of Object.entries(descriptors) as Array<[OfficeKind, (typeof descriptors)[OfficeKind]]>) {
    it(`round-trips native ${kind.toUpperCase()} fixtures with a Password-to-Open container`, async () => {
      const original = await nativeFixture(kind);
      const protectedResult = await processOfficeEncryption({ operation: operation("protect", kind), fileName: `sample.${descriptor.extension}`, contentType: descriptor.mime, inputBase64: original.toString("base64"), password });
      const encrypted = Buffer.from(protectedResult.outputBase64, "base64");

      expect(encrypted.subarray(0, 8).toString("hex")).toBe("d0cf11e0a1b11ae1");
      expect(protectedResult.fileName).toBe(`sample-protected.${descriptor.extension}`);
      expect(protectedResult.contentType).toBe(descriptor.mime);
      expect(protectedResult.encrypted).toBe(true);

      const unlockedResult = await processOfficeEncryption({ operation: operation("unlock", kind), fileName: protectedResult.fileName, contentType: descriptor.mime, inputBase64: protectedResult.outputBase64, password });
      expect(sha256(Buffer.from(unlockedResult.outputBase64, "base64"))).toBe(sha256(original));
      expect(unlockedResult.fileName).toBe(`sample-protected-unlocked.${descriptor.extension}`);
      expect(unlockedResult.encrypted).toBe(false);
    });

    it(`rejects a wrong ${kind.toUpperCase()} password without leaking it`, async () => {
      const original = await nativeFixture(kind);
      const protectedResult = await processOfficeEncryption({ operation: operation("protect", kind), fileName: `sample.${descriptor.extension}`, contentType: descriptor.mime, inputBase64: original.toString("base64"), password });
      await expect(processOfficeEncryption({ operation: operation("unlock", kind), fileName: protectedResult.fileName, contentType: descriptor.mime, inputBase64: protectedResult.outputBase64, password: "Wrong-password-2026" })).rejects.toMatchObject({ message: expect.not.stringContaining("Wrong-password-2026") });
    });
  }

  it("rejects an invalid format, MIME, Base64, oversized input, and an already encrypted protection input", async () => {
    const source = await zipFixture("word");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "sample.xlsx", contentType: descriptors.word.mime, inputBase64: source.toString("base64"), password })).rejects.toThrow("DOCX");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "sample.docx", contentType: "application/pdf", inputBase64: source.toString("base64"), password })).rejects.toThrow("MIME");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "sample.docx", contentType: descriptors.word.mime, inputBase64: "not-base64***", password })).rejects.toThrow("محتوى الملف المرسل غير صالح");
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "large.docx", contentType: descriptors.word.mime, inputBase64: Buffer.alloc(OFFICE_MAX_BYTES + 1, 1).toString("base64"), password })).rejects.toThrow("10 MB");
    const encrypted = await processOfficeEncryption({ operation: "protect-word", fileName: "sample.docx", contentType: descriptors.word.mime, inputBase64: source.toString("base64"), password });
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: encrypted.fileName, contentType: descriptors.word.mime, inputBase64: encrypted.outputBase64, password })).rejects.toThrow("محمي بالفعل");
  });

  it("accepts exactly 10 MiB raw OOXML and rejects one raw byte above the limit", async () => {
    const exactLimit = await sizedNativeFixture("word", OFFICE_MAX_BYTES);
    expect(exactLimit.byteLength).toBe(OFFICE_MAX_BYTES);
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "exact-limit.docx", contentType: descriptors.word.mime, inputBase64: exactLimit.toString("base64"), password })).resolves.toMatchObject({ encrypted: true });
    await expect(processOfficeEncryption({ operation: "protect-word", fileName: "above-limit.docx", contentType: descriptors.word.mime, inputBase64: Buffer.alloc(OFFICE_MAX_BYTES + 1, 1).toString("base64"), password })).rejects.toThrow("10 MB");
  }, 15_000);

  it("rejects Guest and User and allows only Admin at the tRPC procedure", async () => {
    const source = await nativeFixture("word");
    const input = { operation: "protect-word" as const, fileName: "sample.docx", contentType: descriptors.word.mime, inputBase64: source.toString("base64"), password };
    await expect(appRouter.createCaller(context(null)).officeEncryption.process(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("user")).officeEncryption.process(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("admin")).officeEncryption.process(input)).resolves.toMatchObject({ encrypted: true, fileName: "sample-protected.docx" });
  });
});
