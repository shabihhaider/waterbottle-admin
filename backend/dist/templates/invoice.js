"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceHtmlTemplate = invoiceHtmlTemplate;
const PKR = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
const fmt = (n) => PKR.format(Number(n ?? 0));
function esc(v) {
    if (v === undefined || v === null)
        return "";
    return String(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function invoiceHtmlTemplate(data) {
    const issue = data.meta?.issueDate ? new Date(data.meta.issueDate) : new Date();
    const due = data.meta?.dueDate ? new Date(data.meta.dueDate) : undefined;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice${data.summary.invoiceNumber ? ` #${esc(data.summary.invoiceNumber)}` : ""}</title>
  <style>
    :root{--bg:#ffffff;--ink:#0f172a;--muted:#64748b;--line:#e5e7eb}
    *{box-sizing:border-box} html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:800px;margin:0 auto;padding:24px}
    .head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
    .brand{display:flex;align-items:center;gap:12px}
    .brand-logo{width:44px;height:44px;border-radius:10px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .brand-logo img{width:100%;height:100%;object-fit:cover;border-radius:10px}
    .brand-title{font-weight:700;font-size:20px}
    h1{margin:16px 0 4px;font-size:24px}
    .muted{color:var(--muted)}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .card{border:1px solid var(--line);border-radius:12px;padding:16px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line)}
    th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
    tfoot td{border-top:1px solid var(--line)}
    .right{text-align:right}
    .total{font-size:18px;font-weight:700}
    .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:600}
    .note{font-size:12px;color:var(--muted)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="brand">
        <div class="brand-logo">${data.company.logoUrl ? `<img src="${esc(data.company.logoUrl)}" alt="logo"/>` : "💧"}</div>
        <div>
          <div class="brand-title">${esc(data.company.name)}</div>
          <div class="muted">${[data.company.address, data.company.phone].filter(Boolean).map(esc).join(" · ")}</div>
        </div>
      </div>
      ${data.summary.invoiceNumber ? `<div class="badge">Invoice #${esc(data.summary.invoiceNumber)}</div>` : ""}
    </div>

    <div class="grid">
      <div class="card">
        <div class="muted" style="font-size:12px;">Billed To</div>
        <div style="font-weight:600;margin-top:4px">${esc(data.customer.name)}</div>
        ${data.customer.address ? `<div class="muted">${esc(data.customer.address)}</div>` : ""}
        ${data.customer.phone ? `<div class="muted">${esc(data.customer.phone)}</div>` : ""}
      </div>
      <div class="card">
        <div class="muted" style="font-size:12px;">Invoice Info</div>
        <div>Issue Date: <strong>${esc(issue.toLocaleDateString())}</strong></div>
        ${due ? `<div>Due Date: <strong>${esc(due.toLocaleDateString())}</strong></div>` : ""}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <table>
        <thead>
          <tr><th>Description</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Amount</th></tr>
        </thead>
        <tbody>
          ${data.items
        .map((i) => `<tr><td>${esc(i.name)}</td><td class="right">${esc(i.qty)}</td><td class="right">${esc(fmt(i.price))}</td><td class="right">${esc(fmt(i.total))}</td></tr>`)
        .join("")}
        </tbody>
        <tfoot>
          <tr><td colspan="3" class="right">Subtotal</td><td class="right">${fmt(data.summary.subtotal)}</td></tr>
          ${data.summary.tax ? `<tr><td colspan="3" class="right">Tax</td><td class="right">${fmt(data.summary.tax)}</td></tr>` : ""}
          ${data.summary.discount ? `<tr><td colspan="3" class="right">Discount</td><td class="right">-${fmt(data.summary.discount)}</td></tr>` : ""}
          <tr><td colspan="3" class="right total">Total</td><td class="right total">${fmt(data.summary.total)}</td></tr>
        </tfoot>
      </table>
      <p class="note">Thank you for your business!</p>
    </div>
  </div>
</body>
</html>`;
}
//# sourceMappingURL=invoice.js.map