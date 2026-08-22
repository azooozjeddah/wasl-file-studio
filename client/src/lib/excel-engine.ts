import { LocalFileResult, outputName } from "./file-utils";

export type SpreadsheetSheetPreview = {
  key: string;
  name: string;
  rows: string[][];
  rowCount: number;
  columnCount: number;
};

export type SpreadsheetFilePreview = {
  fileName: string;
  fileIndex: number;
  sheets: SpreadsheetSheetPreview[];
};

type WorkbookLike = Awaited<ReturnType<typeof readWorkbook>>;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv;charset=utf-8";
const previewRows = 12;
const previewColumns = 8;

function sheetKey(fileIndex: number, sheetName: string) { return `${fileIndex}::${sheetName}`; }
function cleanSheetName(name: string) { return name.replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Sheet"; }
function uniqueSheetName(existing: Set<string>, candidate: string) {
  const base = cleanSheetName(candidate); let name = base; let index = 2;
  while (existing.has(name)) { name = `${base.slice(0, Math.max(1, 28 - String(index).length))} ${index}`; index += 1; }
  existing.add(name); return name;
}
function valueMatrix(sheet: any, XLSX: any, limitRows?: number, limitColumns?: number) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  return rows.slice(0, limitRows).map(row => row.slice(0, limitColumns).map(value => String(value ?? "")));
}

async function readWorkbook(file: File) {
  const XLSX = await import("xlsx");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const workbook = extension === "csv" ? XLSX.read(await file.text(), { type: "string", codepage: 65001, raw: false }) : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  if (!workbook.SheetNames.length) throw new Error("لم يتم العثور على أوراق قابلة للقراءة داخل الملف.");
  return { XLSX, workbook };
}

export async function inspectSpreadsheetFiles(files: File[]): Promise<SpreadsheetFilePreview[]> {
  return Promise.all(files.map(async (file, fileIndex) => {
    const { XLSX, workbook } = await readWorkbook(file);
    return {
      fileName: file.name,
      fileIndex,
      sheets: workbook.SheetNames.map(name => {
        const allRows = valueMatrix(workbook.Sheets[name], XLSX);
        return {
          key: sheetKey(fileIndex, name), name, rows: allRows.slice(0, previewRows).map(row => row.slice(0, previewColumns)),
          rowCount: allRows.length,
          columnCount: allRows.reduce((max, row) => Math.max(max, row.length), 0),
        };
      }),
    };
  }));
}

function selectedSheetNames(previews: SpreadsheetFilePreview[], fileIndex: number, selectedKeys: string[]) {
  const sheetNames = previews.find(preview => preview.fileIndex === fileIndex)?.sheets.map(sheet => sheet.name) || [];
  const selected = sheetNames.filter(name => selectedKeys.includes(sheetKey(fileIndex, name)));
  return selected.length ? selected : sheetNames;
}

async function renderWorkbookToPdf(file: File, names: string[], report?: (fraction: number) => void): Promise<LocalFileResult> {
  const { XLSX, workbook } = await readWorkbook(file);
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const html2canvas = html2canvasModule.default;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  let hasPage = false; const selected = names.length ? names : workbook.SheetNames;
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", inset: "0 auto auto -20000px", width: "1040px", background: "#fff", color: "#20202c", padding: "28px", zIndex: "-1" });
  document.body.appendChild(host);
  try {
    for (let sheetIndex = 0; sheetIndex < selected.length; sheetIndex += 1) {
      const name = selected[sheetIndex]; const rows = valueMatrix(workbook.Sheets[name], XLSX);
      const populatedRows = rows.length ? rows : [["—"]];
      for (let start = 0; start < populatedRows.length; start += 32) {
        const slice = populatedRows.slice(start, start + 32); const maxColumns = Math.max(1, ...slice.map(row => row.length));
        const table = document.createElement("section"); table.dir = "auto";
        table.innerHTML = `<h1>${escapeHtml(name)}</h1><p>${escapeHtml(file.name)} · ${start + 1}–${Math.min(populatedRows.length, start + 32)}</p><table><tbody>${slice.map((row, rowIndex) => `<tr class="${rowIndex === 0 ? "head" : ""}">${Array.from({ length: maxColumns }, (_, columnIndex) => `<td>${escapeHtml(row[columnIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        const style = document.createElement("style"); style.textContent = `section{font-family:Arial,sans-serif;width:984px}h1{font-size:22px;margin:0 0 6px}p{font-size:12px;color:#686477;margin:0 0 16px}table{border-collapse:collapse;width:100%;table-layout:fixed}td{border:1px solid #d8d5e3;padding:7px 8px;font-size:11px;overflow-wrap:anywhere;vertical-align:top}.head td{font-weight:700;background:#eeeaff}`;
        table.prepend(style); host.appendChild(table);
        const canvas = await html2canvas(table, { scale: 1.35, backgroundColor: "#ffffff", useCORS: true, logging: false });
        const pageWidth = 842; const pageHeight = 595; const ratio = Math.min((pageWidth - 34) / canvas.width, (pageHeight - 34) / canvas.height);
        if (hasPage) pdf.addPage(); hasPage = true;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (pageWidth - canvas.width * ratio) / 2, 17, canvas.width * ratio, canvas.height * ratio, undefined, "FAST");
        table.remove(); report?.((sheetIndex + Math.min(1, (start + 32) / populatedRows.length)) / selected.length);
      }
    }
    return { name: outputName(file.name, "sheets", "pdf"), blob: pdf.output("blob") as Blob, mime: "application/pdf", details: { source: "local-sheet-render", selectedSheets: selected.length, quality: "table-visual" } };
  } finally { host.remove(); }
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character)); }

async function xlsxToCsv(files: File[], previews: SpreadsheetFilePreview[], selectedKeys: string[], report?: (fraction: number) => void) {
  const results: LocalFileResult[] = [];
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex]; const { XLSX, workbook } = await readWorkbook(file); const names = selectedSheetNames(previews, fileIndex, selectedKeys);
    names.forEach((name, sheetIndex) => {
      const csv = `sep=,\r\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: ",", RS: "\r\n", forceQuotes: false })}`;
      results.push({ name: outputName(file.name, cleanSheetName(name), "csv"), blob: new Blob(["\ufeff", csv], { type: CSV_MIME }), mime: "text/csv", details: { source: "local-xlsx-sheet", sheet: name } });
      report?.((fileIndex + (sheetIndex + 1) / names.length) / files.length);
    });
  }
  return results;
}

async function csvToXlsx(files: File[], report?: (fraction: number) => void) {
  const XLSX = await import("xlsx"); const workbook = XLSX.utils.book_new(); const existing = new Set<string>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]; const csvWorkbook = XLSX.read(await file.text(), { type: "string", codepage: 65001, raw: false }); const sourceName = csvWorkbook.SheetNames[0];
    if (!sourceName) throw new Error(`تعذر قراءة CSV: ${file.name}`);
    XLSX.utils.book_append_sheet(workbook, csvWorkbook.Sheets[sourceName], uniqueSheetName(existing, file.name.replace(/\.[^.]+$/, "")));
    report?.((index + 1) / files.length);
  }
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
  return [{ name: outputName(files[0].name, files.length > 1 ? "batch" : "converted", "xlsx"), blob: new Blob([data], { type: XLSX_MIME }), mime: XLSX_MIME, details: { source: "local-csv-workbook", sheets: files.length } }];
}

async function mergeWorkbooks(files: File[], previews: SpreadsheetFilePreview[], selectedKeys: string[], report?: (fraction: number) => void) {
  const XLSX = await import("xlsx"); const workbook = XLSX.utils.book_new(); const existing = new Set<string>(); let added = 0;
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const { workbook: source } = await readWorkbook(files[fileIndex]); const names = selectedSheetNames(previews, fileIndex, selectedKeys);
    names.forEach(name => { XLSX.utils.book_append_sheet(workbook, source.Sheets[name], uniqueSheetName(existing, name)); added += 1; });
    report?.((fileIndex + 1) / files.length);
  }
  if (!added) throw new Error("اختر ورقة واحدة على الأقل لدمجها.");
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
  return [{ name: outputName(files[0].name, "merged", "xlsx"), blob: new Blob([data], { type: XLSX_MIME }), mime: XLSX_MIME, details: { source: "local-workbook-merge", sheets: added } }];
}

export async function processSpreadsheet(files: File[], previews: SpreadsheetFilePreview[], selectedKeys: string[], slug: string, report?: (fraction: number) => void): Promise<LocalFileResult[]> {
  if (!files.length) throw new Error("اختر ملفًا واحدًا على الأقل أولًا.");
  if (slug === "csv-to-xlsx") return csvToXlsx(files, report);
  if (slug === "xlsx-to-csv") return xlsxToCsv(files, previews, selectedKeys, report);
  if (slug === "merge-excel") return mergeWorkbooks(files, previews, selectedKeys, report);
  if (slug === "xlsx-to-pdf") {
    const results: LocalFileResult[] = [];
    for (let index = 0; index < files.length; index += 1) { results.push(await renderWorkbookToPdf(files[index], selectedSheetNames(previews, index, selectedKeys), amount => report?.((index + amount) / files.length))); }
    return results;
  }
  throw new Error("أداة Excel هذه غير مدعومة محليًا بعد.");
}

export const spreadsheetMime = XLSX_MIME;
