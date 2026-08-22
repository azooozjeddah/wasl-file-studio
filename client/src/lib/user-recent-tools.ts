export type RecentToolRecord = { slug: string; usedAt: number };

const MAX_RECENT_TOOLS = 6;
const keyFor = (userId: number) => `wasl_recent_tools_${userId}`;

export function readRecentTools(userId: number, storage: Storage | null = typeof window === "undefined" ? null : window.localStorage): RecentToolRecord[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(keyFor(userId)) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item => typeof item?.slug === "string" && typeof item?.usedAt === "number").slice(0, MAX_RECENT_TOOLS) : [];
  } catch { return []; }
}

export function rememberRecentTool(userId: number, slug: string, storage: Storage | null = typeof window === "undefined" ? null : window.localStorage, usedAt = Date.now()) {
  if (!storage || !slug) return [];
  const next = [{ slug, usedAt }, ...readRecentTools(userId, storage).filter(item => item.slug !== slug)].slice(0, MAX_RECENT_TOOLS);
  storage.setItem(keyFor(userId), JSON.stringify(next));
  return next;
}
