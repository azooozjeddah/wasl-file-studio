import { readFile } from "node:fs/promises";
import { File } from "node:buffer";
import * as XLSX from "xlsx";
import { inspectSpreadsheetFiles, processSpreadsheet } from "../client/src/lib/excel-engine";

const root = "/home/ubuntu/wasl-qa-fixtures";
async function input(name: string, type: string) { return new File([await readFile(`${root}/${name}`)], name, { type }) as unknown as File; }
const xlsx = await input("qa-data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
const csv = await input("qa-data.csv", "text/csv");
const xlsxPreview = await inspectSpreadsheetFiles([xlsx]);
const csvPreview = await inspectSpreadsheetFiles([csv]);
if (xlsxPreview[0]?.sheets[0]?.rows[1]?.[0] !== "وصل") throw new Error("QA_XLSX_ARABIC_PREVIEW_INVALID");
const csvOutput = await processSpreadsheet([xlsx], xlsxPreview, [xlsxPreview[0].sheets[0].key], "xlsx-to-csv");
const csvText = await csvOutput[0].blob.text(); const csvBytes = new Uint8Array(await csvOutput[0].blob.arrayBuffer()); const hasUtf8Bom = csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf; if (!csvText.includes("وصل") || !hasUtf8Bom) throw new Error("QA_XLSX_CSV_OUTPUT_INVALID");
const xlsxOutput = await processSpreadsheet([csv], csvPreview, [], "csv-to-xlsx");
const workbook = XLSX.read(await xlsxOutput[0].blob.arrayBuffer(), { type: "array" }); const parsed = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as string[][];
if (parsed[1]?.[0] !== "وصل") throw new Error("QA_CSV_XLSX_OUTPUT_INVALID");
console.log(JSON.stringify({ xlsxPreview: xlsxPreview[0].sheets[0].rows[1][0], csvBytes: csvOutput[0].blob.size, xlsxSheets: workbook.SheetNames.length }));
