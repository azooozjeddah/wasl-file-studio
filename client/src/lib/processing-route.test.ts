import { describe, expect, it } from "vitest";
import { chooseProcessingRoute, serverRouteAvailable } from "./processing-route";
describe("processing route selection", () => {
  it("never leaves local processing until a server engine is explicitly enabled", () => { expect(chooseProcessingRoute("hybrid", false, "server")).toBe("local"); expect(chooseProcessingRoute("server", false)).toBe("local"); });
  it("uses a server only when both the tool and the platform allow it", () => { expect(chooseProcessingRoute("hybrid", true, "server")).toBe("server"); expect(serverRouteAvailable("hybrid", true)).toBe(true); expect(serverRouteAvailable("local", true)).toBe(false); });
});
