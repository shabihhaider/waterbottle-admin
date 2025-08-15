// backend/src/utils/currency.ts
export const formatPKR = (n: number | string) =>
  new Intl.NumberFormat('ur-PK', { style: 'currency', currency: 'PKR' }).format(Number(n));