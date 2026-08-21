import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it } from "vitest";
import { publicProcedure, router } from "./trpc";
import type { TrpcContext } from "./context";

const probeRouter = router({
  controlledFailure: publicProcedure.query(() => { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "controlled failure" }); }),
});
const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

async function serializedFailure(nodeEnv: string) {
  process.env.NODE_ENV = nodeEnv;
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request("http://localhost/trpc/controlledFailure"),
    router: probeRouter,
    createContext: async () => ({}) as TrpcContext,
  });
  return await response.json() as { error: { json: { data: { stack?: string | null } } } };
}

describe("tRPC HTTP error serialization", () => {
  it("omits stack details from an actual production HTTP error response", async () => {
    const payload = await serializedFailure("production");
    expect(payload.error.json.data.stack).toBeNull();
  });

  it("retains stack details only during development diagnostics", async () => {
    const payload = await serializedFailure("development");
    expect(payload.error.json.data.stack).toContain("controlled failure");
  });
});
