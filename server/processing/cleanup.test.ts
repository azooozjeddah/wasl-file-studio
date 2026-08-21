import { describe, expect, it, vi } from "vitest";
import { releaseExpiredTemporaryFiles } from "./cleanup";

function fakeDb() {
  const removed: unknown[] = [];
  const changed: unknown[] = [];
  const refs = [
    { id: 1, releasedAt: null, expiresAt: new Date("2020-01-01") },
    { id: 2, releasedAt: null, expiresAt: new Date("2030-01-01") },
  ];
  const jobs = [{ id: 3, state: "queued", expiresAt: new Date("2020-01-01") }];
  const db = {
    select: vi.fn().mockReturnValueOnce({ from: () => refs }).mockReturnValueOnce({ from: () => jobs }),
    delete: vi.fn(() => ({ where: (condition: unknown) => { removed.push(condition); } })),
    update: vi.fn(() => ({ set: () => ({ where: (condition: unknown) => { changed.push(condition); } }) })),
  };
  return { db, removed, changed };
}

describe("temporary cleanup", () => {
  it("drops expired storage references while expiring stale jobs", async () => {
    const { db, removed, changed } = fakeDb();
    const result = await releaseExpiredTemporaryFiles(db, new Date("2025-01-01"));
    expect(result).toEqual({ releasedReferences: 1, expiredJobs: 1 });
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(removed).toHaveLength(1);
    expect(changed).toHaveLength(1);
  });
});
