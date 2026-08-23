import type { ToolDefinition } from "@/lib/tools";

type PendingHandoff = { file: File; toolSlug: string; createdAt: number };
let pendingHandoff: PendingHandoff | null = null;

export function prepareFileForTool(file: File, toolSlug: string) { pendingHandoff = { file, toolSlug, createdAt: Date.now() }; }

export function takePendingFileForTool(toolSlug: string) {
  const current = pendingHandoff;
  if (!current || current.toolSlug !== toolSlug || Date.now() - current.createdAt > 5 * 60_000) return undefined;
  pendingHandoff = null;
  return current.file;
}

export function matchesToolInput(file: Pick<File, "name" | "type">, tool: ToolDefinition) {
  const name = file.name.toLowerCase();
  return tool.accepts.some(accept => accept === "*/*" || (accept.endsWith("/*") && file.type.startsWith(accept.slice(0, -1))) || (accept.startsWith(".") && name.endsWith(accept)) || file.type === accept);
}

export function isReadyAssistantTool(tool: ToolDefinition) { return tool.local && !tool.experimental && tool.readiness !== "improving" && tool.slug !== "pptx-to-pdf"; }

/** These tools cannot perform their core operation until the user supplies an additional file. */
export function isSingleFileReadyAssistantTool(tool: ToolDefinition) {
  return isReadyAssistantTool(tool) && !["merge-pdf", "compare-pdf", "merge-excel", "file-hash"].includes(tool.slug);
}
