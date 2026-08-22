import { describe, expect, it } from "vitest";
import { formatSelectedFileCount, mergeFileSelection } from "./file-queue";

describe("mergeFileSelection", () => {
  it("appends a later selection for multi-file tools instead of replacing the queue", () => {
    expect(mergeFileSelection(["first.pdf"], ["second.pdf"], true)).toEqual(["first.pdf", "second.pdf"]);
  });

  it("keeps replacement behavior for single-file tools and ignores an empty selection", () => {
    expect(mergeFileSelection(["first.pdf"], ["second.pdf"], false)).toEqual(["second.pdf"]);
    expect(mergeFileSelection(["first.pdf"], [], true)).toEqual(["first.pdf"]);
  });

  it("uses an Arabic file count without appending an English plural suffix", () => {
    expect(formatSelectedFileCount(1, true)).toBe("ملف واحد");
    expect(formatSelectedFileCount(2, true)).toBe("ملفان");
    expect(formatSelectedFileCount(3, true)).toBe("3 ملفات");
    expect(formatSelectedFileCount(2, false)).toBe("2 files");
  });
});
