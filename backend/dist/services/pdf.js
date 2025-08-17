"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderInvoicePDF = renderInvoicePDF;
async function renderInvoicePDF(html, executablePath) {
    let puppeteer;
    try {
        if (executablePath) {
            puppeteer = require('puppeteer-core');
        }
        else {
            puppeteer = require('puppeteer');
        }
    }
    catch {
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
        return pdf;
    }
    finally {
        await browser.close();
    }
}
exports.default = renderInvoicePDF;
//# sourceMappingURL=pdf.js.map