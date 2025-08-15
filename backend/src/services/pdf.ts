// ---------------------------------------------
// File: backend/src/services/pdf.ts
// ---------------------------------------------
// Uses puppeteer (or puppeteer-core with a provided executablePath) to render HTML to PDF Buffer
export async function renderInvoicePDF(html: string, executablePath?: string): Promise<Buffer> {
  // Lazy require to avoid import cost when not used (and to allow either dependency)
  let puppeteer: any;
  try {
    // Prefer puppeteer-core if an executablePath is supplied (e.g., on AWS Lambda / custom Chrome)
    if (executablePath) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      puppeteer = require('puppeteer-core');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      puppeteer = require('puppeteer');
    }
  } catch {
    // Fallback to puppeteer in case only one is installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    puppeteer = require('puppeteer');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '24mm', right: '16mm', bottom: '24mm', left: '16mm' },
    });

    return pdf as Buffer;
  } finally {
    await browser.close();
  }
}

export default renderInvoicePDF;
