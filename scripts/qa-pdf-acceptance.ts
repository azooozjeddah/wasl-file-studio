import { readFile } from "node:fs/promises";
import { File } from "node:buffer";
import { PDFDocument } from "pdf-lib";
import { mergePdfs, repairPdf } from "../client/src/lib/pdf-engine";

const root = "/home/ubuntu/wasl-qa-fixtures";
async function input(name: string) { return new File([await readFile(`${root}/${name}`)], name, { type: "application/pdf" }) as unknown as File; }

const alpha = await input("qa-alpha.pdf"); const beta = await input("qa-beta.pdf");
const merged = await mergePdfs([alpha, beta]); const mergedDoc = await PDFDocument.load(await merged.blob.arrayBuffer());
if (mergedDoc.getPageCount() !== 2 || merged.blob.size === 0) throw new Error("QA_MERGE_OUTPUT_INVALID");
const repaired = await repairPdf(alpha); const repairedDoc = await PDFDocument.load(await repaired.blob.arrayBuffer());
if (repairedDoc.getPageCount() !== 1 || repaired.blob.size === 0) throw new Error("QA_REPAIR_OUTPUT_INVALID");
console.log(JSON.stringify({ mergePages: mergedDoc.getPageCount(), repairPages: repairedDoc.getPageCount(), note: "Comparison is browser-worker based and is checked through the application UI." }));
