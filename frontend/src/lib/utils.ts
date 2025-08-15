// =============================================
// File: src/lib/utils.ts
// General utilities used across pages/components
// =============================================

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(fn: T, wait = 200) {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

export function assert(cond: any, message = "Assertion failed"): asserts cond {
  if (!cond) throw new Error(message);
}

export function invariant(cond: any, message = "Invariant failed") {
  if (!cond) throw new Error(message);
}

export function toTitleCase(s?: string | null) {
  if (!s) return "";
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

export function joinAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

export function safeJSON<T = any>(v: any, fb: T): T {
  try {
    return JSON.parse(v);
  } catch {
    return fb;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export * from "./format";
