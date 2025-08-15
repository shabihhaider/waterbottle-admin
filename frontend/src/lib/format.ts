// =============================================
// File: src/lib/format.ts
// Formatting helpers for currency, numbers, percent and dates.
// =============================================

export const PKR = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

export function formatPKR(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return PKR.format(0);
  return PKR.format(n);
}

export const fmtNumber = (n: number | string) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : "0";
};

export const fmtPercent = (n: number | string, digits = 1) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return `0.${"0".repeat(digits)}%`;
  return `${v.toFixed(digits)}%`;
};

export const fmtDate = (d?: string | number | Date | null) => {
  if (!d) return "-";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
};

export const fmtDateTime = (d?: string | number | Date | null) => {
  if (!d) return "-";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

// Short human format, e.g., 1.2K, 3.4M
export function compactNumber(n?: number | null) {
  if (!n || !Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
