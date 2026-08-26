import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { inspectSpreadsheetFiles, processSpreadsheet } from "./excel-engine";

const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function workbookFile(name: string, sheets: Array<{ name: string; rows: Array<Array<string | number>> }>) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name));
  return new File([XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true })], name, { type: xlsxMime });
}

async function bytes(file: File) {
  return Array.from(new Uint8Array(await file.arrayBuffer()));
}

describe("merge-excel functional acceptance", () => {
  it("merges selected sheets through inspectSpreadsheetFiles and processSpreadsheet with deterministic ordering, unique names, Arabic content, progress, and immutable inputs", async () => {
    const first = workbookFile("quarter-one.xlsx", [
      { name: "Summary", rows: [["Quarter", "Revenue"], ["Q1", 1250]] },
      { name: "Ignore", rows: [["Private"], ["not selected"]] },
    ]);
    const second = workbookFile("quarter-two.xlsx", [
      { name: "Summary", rows: [["Quarter", "Revenue"], ["Q2", 1775]] },
      { name: "العربية", rows: [["المدينة", "الحالة"], ["الرياض", "مكتمل"]] },
    ]);
    const before = await Promise.all([bytes(first), bytes(second)]);

    const previews = await inspectSpreadsheetFiles([first, second]);
    expect(previews.map(preview => preview.sheets.map(sheet => sheet.key))).toEqual([
      ["0::Summary", "0::Ignore"],
      ["1::Summary", "1::العربية"],
    ]);

    const progress: number[] = [];
    const [result] = await processSpreadsheet(
      [first, second],
      previews,
      ["0::Summary", "1::Summary", "1::العربية"],
      "merge-excel",
      amount => progress.push(amount),
    );

    expect(result).toBeDefined();
    expect(result!.mime).toBe(xlsxMime);
    expect(result!.name).toBe("quarter-one-merged.xlsx");
    expect(result!.blob.size).toBeGreaterThan(100);
    expect([...new Uint8Array(await result!.blob.arrayBuffer()).slice(0, 2)]).toEqual([0x50, 0x4b]);

    const merged = XLSX.read(await result!.blob.arrayBuffer(), { type: "array", cellDates: true });
    expect(merged.SheetNames).toEqual(["Summary", "Summary 2", "العربية"]);
    expect(XLSX.utils.sheet_to_json(merged.Sheets.Summary!, { header: 1 })).toEqual([["Quarter", "Revenue"], ["Q1", 1250]]);
    expect(XLSX.utils.sheet_to_json(merged.Sheets["Summary 2"]!, { header: 1 })).toEqual([["Quarter", "Revenue"], ["Q2", 1775]]);
    expect(XLSX.utils.sheet_to_json(merged.Sheets["العربية"]!, { header: 1 })).toEqual([["المدينة", "الحالة"], ["الرياض", "مكتمل"]]);
    expect(merged.SheetNames).not.toContain("Ignore");

    expect(progress.every(amount => Number.isFinite(amount) && amount >= 0 && amount <= 1)).toBe(true);
    expect(progress).toEqual([0.5, 1]);
    await expect(Promise.all([bytes(first), bytes(second)])).resolves.toEqual(before);
  });

  it("merges all available sheets when selectedKeys is empty according to the engine contract", async () => {
    const source = workbookFile("selection.xlsx", [
      { name: "Only sheet", rows: [["Value"], [1]] },
      { name: "Second sheet", rows: [["Value"], ["kept"]] },
    ]);
    const previews = await inspectSpreadsheetFiles([source]);

    const [result] = await processSpreadsheet([source], previews, [], "merge-excel");
    const merged = XLSX.read(await result!.blob.arrayBuffer(), { type: "array" });
    expect(merged.SheetNames).toEqual(["Only sheet", "Second sheet"]);
    expect(XLSX.utils.sheet_to_json(merged.Sheets["Only sheet"]!, { header: 1 })).toEqual([["Value"], [1]]);
    expect(XLSX.utils.sheet_to_json(merged.Sheets["Second sheet"]!, { header: 1 })).toEqual([["Value"], ["kept"]]);
  });
});
