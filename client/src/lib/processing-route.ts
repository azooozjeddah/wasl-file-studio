export type ToolProcessingMode = "local" | "server" | "hybrid" | "server-ready";
export type ProcessingRoute = "local" | "server";

/** Local is deliberately the safe default. A server route can only be selected after an administrator enables it. */
export function chooseProcessingRoute(mode: ToolProcessingMode | undefined, serverEnabled: boolean, preferred: "auto" | ProcessingRoute = "auto"): ProcessingRoute {
  if (preferred === "local") return "local";
  if (mode === "server" && serverEnabled) return "server";
  if (mode === "hybrid" && serverEnabled && preferred === "server") return "server";
  return "local";
}
export function serverRouteAvailable(mode: ToolProcessingMode | undefined, serverEnabled: boolean) { return serverEnabled && (mode === "server" || mode === "hybrid"); }
