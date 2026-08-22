import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePageList } from "./pdf-engine";

describe("parsePageList", () => {
  it("keeps the browser document distinct from the PDF document while rendering pages", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/pdf-engine.ts"), "utf8");
    expect(source).toContain("const pdfDocument = await pdfjs.getDocument");
    expect(source).toContain("window.document.createElement(\"canvas\")");
  });
  it("expands ranges while preserving the user order", () => expect(parsePageList("3,1-2,5", 5)).toEqual([2, 0, 1, 4]));
  it("uses the full document when no range is supplied", () => expect(parsePageList("", 3)).toEqual([0, 1, 2]));
  it("rejects unsafe or out-of-range page specifications", () => expect(() => parsePageList("0,2", 3)).toThrow("اختر صفحات"));
});
