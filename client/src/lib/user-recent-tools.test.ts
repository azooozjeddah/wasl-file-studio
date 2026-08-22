import { describe, expect, it } from "vitest";
import { readRecentTools, rememberRecentTool } from "./user-recent-tools";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) } as Storage;
}

describe("user recent tools", () => {
  it("keeps a user-local deduplicated and bounded recent list", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 7; index++) rememberRecentTool(4, `tool-${index}`, storage, index);
    rememberRecentTool(4, "tool-3", storage, 99);
    const list = readRecentTools(4, storage);
    expect(list).toHaveLength(6);
    expect(list[0]).toMatchObject({ slug: "tool-3", usedAt: 99 });
    expect(list.filter(item => item.slug === "tool-3")).toHaveLength(1);
  });
});
