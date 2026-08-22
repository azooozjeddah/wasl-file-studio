/**
 * Keeps sequential selections for multi-file tools while preserving the
 * replacement behavior required by single-file tools.
 */
export function mergeFileSelection<T>(current: T[], incoming: T[], allowsMultiple: boolean): T[] {
  if (!incoming.length) return current;
  return allowsMultiple ? [...current, ...incoming] : [incoming[0]];
}

export function formatSelectedFileCount(count: number, isArabic: boolean): string {
  if (!isArabic) return `${count} file${count === 1 ? "" : "s"}`;
  if (count === 1) return "ملف واحد";
  if (count === 2) return "ملفان";
  if (count >= 3 && count <= 10) return `${count} ملفات`;
  return `${count} ملف`;
}
