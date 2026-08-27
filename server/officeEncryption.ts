import { TRPCError } from "@trpc/server";
import JSZip from "jszip";
import officeCrypto from "officecrypto-tool";

export const OFFICE_MAX_BYTES = 10 * 1024 * 1024;
export const OFFICE_MAX_BASE64_LENGTH = Math.ceil(OFFICE_MAX_BYTES / 3) * 4 + 16;
export const officeOperations = [
  "protect-word",
  "unlock-word",
  "protect-excel",
  "unlock-excel",
  "protect-powerpoint",
  "unlock-powerpoint",
] as const;

export type OfficeOperation = (typeof officeOperations)[number];

type OfficeKind = "word" | "excel" | "powerpoint";
type OfficeDescriptor = {
  kind: OfficeKind;
  extension: "docx" | "xlsx" | "pptx";
  mime: string;
  requiredParts: string[];
};

const descriptors: Record<OfficeKind, OfficeDescriptor> = {
  word: {
    kind: "word",
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    requiredParts: ["[Content_Types].xml", "_rels/.rels", "word/document.xml"],
  },
  excel: {
    kind: "excel",
    extension: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    requiredParts: ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"],
  },
  powerpoint: {
    kind: "powerpoint",
    extension: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    requiredParts: ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"],
  },
};

export type OfficeEncryptionRequest = {
  operation: OfficeOperation;
  fileName: string;
  contentType: string;
  inputBase64: string;
  password: string;
};

export type OfficeEncryptionResult = {
  fileName: string;
  contentType: string;
  outputBase64: string;
  bytes: number;
  encrypted: boolean;
};

function requestError(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function descriptorFor(operation: OfficeOperation): OfficeDescriptor {
  if (operation.endsWith("word")) return descriptors.word;
  if (operation.endsWith("excel")) return descriptors.excel;
  return descriptors.powerpoint;
}

function isProtect(operation: OfficeOperation) {
  return operation.startsWith("protect-");
}

function extensionOf(fileName: string) {
  return fileName.trim().toLowerCase().split(".").pop() || "";
}

function safeBaseName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^\w\- .\u0600-\u06ff]/gi, "-").slice(0, 90).trim();
  return base || "wasl-office-file";
}

function decodeBase64(inputBase64: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(inputBase64) || inputBase64.length % 4 !== 0) {
    requestError("محتوى الملف المرسل غير صالح.");
  }
  if (inputBase64.length > OFFICE_MAX_BASE64_LENGTH) {
    requestError("حجم الملف يتجاوز الحد الآمن لهذه الأداة وهو 10 MB.");
  }
  const buffer = Buffer.from(inputBase64, "base64");
  if (!buffer.length || buffer.byteLength > OFFICE_MAX_BYTES) {
    requestError("حجم الملف يتجاوز الحد الآمن لهذه الأداة وهو 10 MB.");
  }
  return buffer;
}

async function assertOoxmlPackage(input: Buffer, descriptor: OfficeDescriptor) {
  if (input.subarray(0, 4).toString("binary") !== "PK\x03\x04") {
    requestError("الملف ليس حزمة Office OOXML صالحة.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input, { checkCRC32: false, createFolders: false });
  } catch {
    requestError("الملف غير قابل لقراءة حزمة Office بصورة آمنة.");
  }
  const entries = Object.values(zip.files);
  if (!entries.length || entries.length > 4_000) {
    requestError("حزمة Office تتجاوز العدد الآمن للملفات الداخلية.");
  }
  if (!descriptor.requiredParts.every(part => Boolean(zip.file(part)))) {
    requestError("نوع ملف Office لا يطابق الأداة المختارة أو أن الحزمة غير مكتملة.");
  }
}

function assertRequestContract(request: OfficeEncryptionRequest, descriptor: OfficeDescriptor) {
  if (extensionOf(request.fileName) !== descriptor.extension) {
    requestError(`هذه الأداة تقبل ملفات .${descriptor.extension.toUpperCase()} فقط.`);
  }
  const type = request.contentType.trim().toLowerCase();
  if (type !== descriptor.mime && type !== "application/octet-stream") {
    requestError("نوع MIME لا يطابق صيغة Office المطلوبة.");
  }
  if (request.password.length < 8 || request.password.length > 255) {
    requestError("يجب أن تتكون كلمة المرور من 8 إلى 255 حرفًا.");
  }
}

function detectEncryption(input: Buffer) {
  try {
    return officeCrypto.isEncrypted(input);
  } catch {
    requestError("الملف ليس حزمة Office صالحة أو مشفرة بصيغة مدعومة.");
  }
}

function safeCryptoError(error: unknown): never {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("password") || message.includes("decrypt") || message.includes("verify")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "تعذر فتح الملف. تحقق من كلمة المرور أو من أن الملف مشفر بصيغة Office مدعومة.",
    });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "تعذر معالجة ملف Office. تحقق من الصيغة وحاول مرة أخرى." });
}

/** Processes one OOXML file only in request memory; it never persists file bytes or passwords. */
export async function processOfficeEncryption(request: OfficeEncryptionRequest): Promise<OfficeEncryptionResult> {
  const descriptor = descriptorFor(request.operation);
  assertRequestContract(request, descriptor);

  let input: Buffer | undefined;
  let output: Buffer | undefined;
  try {
    input = decodeBase64(request.inputBase64);
    const encrypted = detectEncryption(input);

    if (isProtect(request.operation)) {
      if (encrypted) {
        requestError("الملف محمي بالفعل. استخدم أداة فك الحماية عندما تملك كلمة المرور.");
      }
      await assertOoxmlPackage(input, descriptor);
      output = officeCrypto.encrypt(input, { password: request.password });
      if (!detectEncryption(output)) {
        throw new Error("Encryption output was not recognized as Office encrypted.");
      }
    } else {
      if (!encrypted) {
        requestError("الملف ليس ملف Office مشفرًا بكلمة مرور فتح مدعومة.");
      }
      try {
        output = await officeCrypto.decrypt(input, { password: request.password });
      } catch (error) {
        safeCryptoError(error);
      }
      await assertOoxmlPackage(output, descriptor);
    }

    const suffix = isProtect(request.operation) ? "protected" : "unlocked";
    return {
      fileName: `${safeBaseName(request.fileName)}-${suffix}.${descriptor.extension}`,
      contentType: descriptor.mime,
      outputBase64: output.toString("base64"),
      bytes: output.byteLength,
      encrypted: isProtect(request.operation),
    };
  } finally {
    input?.fill(0);
    output?.fill(0);
  }
}
