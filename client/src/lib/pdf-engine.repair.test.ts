import { describe, expect, it } from "vitest";
import { classifyPdfRepairFailure, classifyPdfRepairIssue, inspectPdfRepairInput } from "./pdf-engine";

describe("repair-pdf inspection contracts", () => {
  it("flags an out-of-range startxref as a recoverable pre-write signal without calling it a repair yet", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n999999\n%%EOF");
    expect(inspectPdfRepairInput(bytes)).toMatchObject({ hasPdfHeader: true, startXrefOffset: 999999, startXrefRecoverableIssue: true });
  });

  it("keeps a conventional xref offset outside the repair signal", () => {
    const source = "%PDF-1.7\nxref\n0 1\n0000000000 65535 f \nstartxref\n9\n%%EOF";
    expect(inspectPdfRepairInput(new TextEncoder().encode(source)).startXrefRecoverableIssue).toBe(false);
  });

  it("classifies protected, non-PDF, and parse failures conservatively", () => {
    expect(classifyPdfRepairFailure(new Error("Input document is encrypted"))).toBe("password-protected");
    expect(classifyPdfRepairFailure(new Error("No PDF header found"))).toBe("unsupported-file");
    expect(classifyPdfRepairFailure(new Error("Couldn't read xref table"))).toBe("unrepairable");
    expect(classifyPdfRepairIssue(new Error("Couldn't read xref table"))).toBe("xref");
    expect(classifyPdfRepairIssue(new Error("Invalid page tree"))).toBe("page-tree");
    expect(classifyPdfRepairIssue(new Error("Unable to parse stream"))).toBe("stream");
  });
});
