import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { inspectSpreadsheetFiles, processSpreadsheet } from "./excel-engine";

const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function workbookFile(name: string, sheets: Array<{ name: string; rows: Array<Array<string | number>> }>) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name));
  return new File([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], name, { type: xlsxMime });
}

describe("local Excel engine", () => {
  it("inspects sheets and exports only the selected XLSX sheet as CSV", async () => {
    const source = workbookFile("sales.xlsx", [{ name: "Sales", rows: [["Item", "Total"], ["Tea", 12]] }, { name: "Archive", rows: [["Year"], [2025]] }]);
    const previews = await inspectSpreadsheetFiles([source]);
    expect(previews[0]?.sheets.map(sheet => sheet.name)).toEqual(["Sales", "Archive"]);
    const results = await processSpreadsheet([source], previews, ["0::Sales"], "xlsx-to-csv");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("sales-Sales.csv");
    await expect(results[0]?.blob.text()).resolves.toContain("Tea");
  });

  it("converts a batch of CSV files into a single local XLSX workbook", async () => {
    const results = await processSpreadsheet([new File(["Name,Score\nA,10"], "scores.csv", { type: "text/csv" }), new File(["Name,Score\nB,11"], "scores-2.csv", { type: "text/csv" })], [], [], "csv-to-xlsx");
    const workbook = XLSX.read(await results[0]!.blob.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toEqual(["scores", "scores-2"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.scores!, { header: 1 })[1]).toEqual(["A", 10]);
  });

  it("keeps Arabic UTF-8 CSV text readable in the local sheet preview", async () => {
    const preview = await inspectSpreadsheetFiles([new File(["\ufeffالاسم,المدينة\nسارة,الرياض"], "contacts.csv", { type: "text/csv" })]);
    expect(preview[0]?.sheets[0]?.rows).toEqual([["الاسم", "المدينة"], ["سارة", "الرياض"]]);
  });

  it("merges selected sheets from separate workbooks without file upload", async () => {
    const first = workbookFile("one.xlsx", [{ name: "Summary", rows: [["A"], [1]] }]);
    const second = workbookFile("two.xlsx", [{ name: "Summary", rows: [["B"], [2]] }]);
    const previews = await inspectSpreadsheetFiles([first, second]);
    const results = await processSpreadsheet([first, second], previews, ["0::Summary", "1::Summary"], "merge-excel");
    const workbook = XLSX.read(await results[0]!.blob.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toEqual(["Summary", "Summary 2"]);
    expect(results[0]?.name).toBe("one-merged.xlsx");
  });
});
