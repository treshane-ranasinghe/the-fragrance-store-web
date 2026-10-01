/** Original site format: "LKR 38,500" (whole rupees). Invoices / admin keep "Rs. 38,500.00". */
export function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return `LKR ${Math.round(Number.isFinite(v) ? v : 0).toLocaleString('en-US')}`;
}
