import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getWaslSessionUser } from "../auth/waslAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Public and administrative Wasl sessions are independent from the platform OAuth.
  // A missing or invalid cookie is safe for public procedures and never redirects users externally.
  user = await getWaslSessionUser(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
