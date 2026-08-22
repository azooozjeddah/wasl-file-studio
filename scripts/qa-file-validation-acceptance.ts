import { File } from "node:buffer";
import { validateLocalFile } from "../client/src/lib/file-utils";

async function expectReject(file: File, family: Parameters<typeof validateLocalFile>[1], token: string) {
  try { await validateLocalFile(file as unknown as File, family); } catch (error) { if (String(error).includes(token)) return; throw error; }
  throw new Error(`QA_EXPECTED_REJECTION_${token}`);
}

await expectReject(new File([], "empty.pdf", { type: "application/pdf" }), "pdf", "فارغ");
await expectReject(new File(["not a PDF"], "wrong.pdf", { type: "application/pdf" }), "pdf", "فعلي غير مدعوم");
await expectReject(new File([new Uint8Array(101 * 1024 * 1024)], "large.pdf", { type: "application/pdf" }), "pdf", "الحد الأقصى");
console.log(JSON.stringify({ empty: "rejected", unsupported: "rejected", large: "rejected" }));
