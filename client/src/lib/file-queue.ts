/**
 * Keeps sequential selections for multi-file tools while preserving the
 * replacement behavior required by single-file tools.
 */
export function mergeFileSelection<T>(current: T[], incoming: T[], allowsMultiple: boolean): T[] {
  if (!incoming.length) return current;
  return allowsMultiple ? [...current, ...incoming] : [incoming[0]];
}
