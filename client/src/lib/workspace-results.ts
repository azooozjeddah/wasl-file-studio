import type { LocalFileResult } from "./file-utils";
import { resultPreviewKind } from "./file-utils";

export function workspaceResultState(results: LocalFileResult[]) {
  return { showZipDownload: results.length > 1, previewKinds: results.map(result => resultPreviewKind(result.mime)), hasTextExport: results.some(result => result.mime === "text/plain") } as const;
}
