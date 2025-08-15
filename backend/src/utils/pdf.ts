// backend/src/utils/pdf.ts
import puppeteer from 'puppeteer';

export async function renderInvoicePDF(html: string, executablePath?: string) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdf;
}

export function invoiceHtmlTemplate(params: {
  company: { name: string; address?: string; phone?: string };
  customer: { name: string; address?: string; phone?: string };
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  summary: { subtotal: number; tax: number; discount: number; total: number; invoiceNumber: number };
}) {
  const { company, customer, items, summary } = params;
  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    body{font-family: Arial, sans-serif; padding:24px;}
    h1{font-size:20px;margin:0 0 8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}
    .right{text-align:right}
    .muted{color:#666}
  </style></head><body>
  <h1>Invoice #${summary.invoiceNumber}</h1>
  <div class="muted">${company.name}<br>${company.address ?? ''}<br>${company.phone ?? ''}</div>
  <hr/>
  <div><strong>Bill To:</strong><br>${customer.name}<br>${customer.address ?? ''}<br>${customer.phone ?? ''}</div>
  <table><thead><tr><th>Item</th><th>Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
  <tbody>
  ${items.map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td class="right">${i.price.toFixed(2)}</td><td class="right">${i.total.toFixed(2)}</td></tr>`).join('')}
  </tbody></table>
  <table style="margin-top:12px">
    <tr><td class="right"><strong>Subtotal</strong></td><td class="right">${summary.subtotal.toFixed(2)}</td></tr>
    <tr><td class="right"><strong>Tax</strong></td><td class="right">${summary.tax.toFixed(2)}</td></tr>
    <tr><td class="right"><strong>Discount</strong></td><td class="right">${summary.discount.toFixed(2)}</td></tr>
    <tr><td class="right"><strong>Total</strong></td><td class="right">${summary.total.toFixed(2)}</td></tr>
  </table>
  </body></html>`;
}