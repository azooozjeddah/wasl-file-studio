export type HashAlgorithm = "SHA-256" | "SHA-512";

export function hexDigest(buffer: ArrayBuffer) { return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join(""); }
export async function hashFile(file: File, algorithm: HashAlgorithm, report?: (fraction: number) => void) { report?.(.15); const bytes = await file.arrayBuffer(); report?.(.65); const digest = await crypto.subtle.digest(algorithm, bytes); report?.(1); return hexDigest(digest); }
