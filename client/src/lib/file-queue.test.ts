import { describe, expect, it } from "vitest";
import { mergeFileSelection } from "./file-queue";

describe("mergeFileSelection", () => {
  it("appends a later selection for multi-file tools instead of replacing the queue", () => {
    expect(mergeFileSelection(["first.pdf"], ["second.pdf"], true)).toEqual(["first.pdf", "second.pdf"]);
  });

  it("keeps replacement behavior for single-file tools and ignores an empty selection", () => {
    expect(mergeFileSelection(["first.pdf"], ["second.pdf"], false)).toEqual(["second.pdf"]);
    expect(mergeFileSelection(["first.pdf"], [], true)).toEqual(["first.pdf"]);
  });
});
