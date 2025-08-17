"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const invoice_1 = require("../templates/invoice");
const pdf_1 = require("../services/pdf");
const env_1 = require("../env");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const isDev = process.env.NODE_ENV !== 'production';
const allowDevBypass = isDev || String(process.env.ALLOW_DEV_AUTH || '').toLowerCase() === 'true';
const router = (0, express_1.Router)();
const S3_BUCKET = env_1.env.S3_BUCKET || '';
const hasS3 = Boolean(S3_BUCKET && env_1.env.S3_REGION && env_1.env.S3_ACCESS_KEY_ID && env_1.env.S3_SECRET_ACCESS_KEY);
const s3 = hasS3
    ? new aws_sdk_1.default.S3({
        accessKeyId: env_1.env.S3_ACCESS_KEY_ID,
        secretAccessKey: env_1.env.S3_SECRET_ACCESS_KEY,
        region: env_1.env.S3_REGION,
    })
    : null;
const LOCAL_DIR = path_1.default.resolve(process.cwd(), 'storage', 'invoices');
async function ensureLocalDir() { if (!hasS3)
    await promises_1.default.mkdir(LOCAL_DIR, { recursive: true }); }
const localPdfPath = (id, no) => path_1.default.join(LOCAL_DIR, `invoice-${no}-${id}.pdf`);
const localPdfUrl = (id) => `/api/invoices/${id}/pdf/raw`;
const NumberLike = zod_1.z.coerce.number();
const CreateSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    orderId: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        qty: zod_1.z.coerce.number().int().positive(),
        price: zod_1.z.coerce.number().nonnegative(),
    })).min(1),
    tax: NumberLike.nonnegative().default(0),
    discount: NumberLike.nonnegative().default(0),
    dueDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const parseDueDate = (d) => (d && d.trim() ? (isNaN(new Date(`${d}T00:00:00`).getTime()) ? undefined : new Date(`${d}T00:00:00`)) : undefined);
async function ensureUserExists(email) {
    let u = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!u) {
        const passwordHash = await bcryptjs_1.default.hash('dev123', 10);
        u = await prisma_1.prisma.user.create({ data: { email, name: 'Dev Admin', role: 'ADMIN', passwordHash } });
    }
    return u;
}
async function resolveUserId(req) {
    const hinted = req?.user?.id;
    if (hinted) {
        const u = await prisma_1.prisma.user.findUnique({ where: { id: hinted } });
        if (u)
            return u.id;
    }
    const envId = process.env.DEFAULT_USER_ID;
    if (envId) {
        const u = await prisma_1.prisma.user.findUnique({ where: { id: envId } });
        if (u)
            return u.id;
    }
    const envEmail = process.env.SYSTEM_USER_EMAIL || process.env.DEFAULT_USER_EMAIL;
    if (envEmail) {
        const u = await prisma_1.prisma.user.findUnique({ where: { email: envEmail } });
        if (u)
            return u.id;
    }
    const first = await prisma_1.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (first)
        return first.id;
    const devEmail = process.env.SYSTEM_USER_EMAIL || 'dev@local.test';
    const passwordHash = await bcryptjs_1.default.hash('dev123', 10);
    const created = await prisma_1.prisma.user.create({
        data: { email: devEmail, name: 'Dev Admin', role: 'ADMIN', passwordHash },
    });
    return created.id;
}
async function buildInvoiceHtml(inv) {
    const customer = await prisma_1.prisma.customer.findUnique({ where: { id: inv.customerId } });
    return (0, invoice_1.invoiceHtmlTemplate)({
        company: { name: 'HydroPak Pvt. Ltd.', address: 'Lahore, Pakistan', phone: '+92 300 0000000' },
        customer: { name: customer?.name || 'Customer', address: customer?.address ?? '', phone: customer?.phone ?? '' },
        items: inv.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, total: i.qty * i.price })),
        summary: { subtotal: inv.subtotal, tax: inv.tax, discount: inv.discount, total: inv.total, invoiceNumber: String(inv.invoiceNumber) },
        meta: { issueDate: inv.createdAt, dueDate: inv.dueDate ?? undefined },
    });
}
async function uploadToS3(key, body) {
    if (!s3)
        throw new Error('S3 not configured');
    const up = await s3.upload({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: 'application/pdf', ACL: 'private' }).promise();
    return up.Location;
}
function signS3Url(location) {
    if (!s3)
        return null;
    try {
        const u = new URL(location);
        const Key = u.pathname.replace(/^\//, '');
        return s3.getSignedUrl('getObject', { Bucket: S3_BUCKET, Key, Expires: 600, ResponseContentDisposition: 'inline', ResponseContentType: 'application/pdf' });
    }
    catch {
        return null;
    }
}
router.get('/:id/pdf/raw', async (req, res) => {
    try {
        if (hasS3)
            return res.status(404).json({ error: 'Not available with S3' });
        if (!allowDevBypass)
            return res.status(401).json({ error: 'Unauthorized' });
        const inv = await prisma_1.prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!inv)
            return res.status(404).json({ error: 'Not found' });
        const p = localPdfPath(inv.id, inv.invoiceNumber);
        try {
            await promises_1.default.access(p);
        }
        catch {
            return res.status(404).json({ error: 'PDF not generated yet' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="invoice.pdf"');
        const buf = await promises_1.default.readFile(p);
        res.end(buf);
    }
    catch (err) {
        console.error('GET /invoices/:id/pdf/raw error:', err);
        res.status(500).json({ error: 'Failed to stream PDF' });
    }
});
router.use(auth_1.requireAuth);
router.get('/', async (_req, res) => {
    try {
        const invoices = await prisma_1.prisma.invoice.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' } });
        res.json(invoices);
    }
    catch (err) {
        console.error('GET /invoices error:', err);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const inv = await prisma_1.prisma.invoice.findUnique({ where: { id: req.params.id }, include: { customer: true } });
        if (!inv)
            return res.status(404).json({ error: 'Not found' });
        res.json(inv);
    }
    catch (err) {
        console.error('GET /invoices/:id error:', err);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});
router.post('/', async (req, res) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const { customerId, orderId, items, tax, discount, dueDate } = parsed.data;
        const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
        const total = subtotal + tax - discount;
        const ownerId = await resolveUserId(req);
        const due = parseDueDate(dueDate);
        const invoice = await prisma_1.prisma.$transaction(async (tx) => {
            const inv = await tx.invoice.create({
                data: {
                    customerId,
                    orderId: orderId || null,
                    subtotal,
                    tax,
                    discount,
                    total,
                    balance: total,
                    userId: ownerId,
                    ...(due ? { dueDate: due } : {}),
                },
                include: { customer: true },
            });
            await tx.invoiceItem.createMany({
                data: items.map(i => ({
                    invoiceId: inv.id,
                    name: i.name,
                    qty: i.qty,
                    price: i.price,
                    lineTotal: i.qty * i.price,
                })),
            });
            return inv;
        });
        res.status(201).json(invoice);
    }
    catch (err) {
        console.error('POST /invoices error:', err);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});
router.put('/:id/status', async (req, res) => {
    const schema = zod_1.z.object({ status: zod_1.z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']), paidAmount: zod_1.z.coerce.number().nonnegative().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const inv = await prisma_1.prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!inv)
            return res.status(404).json({ error: 'Not found' });
        const paidAmount = parsed.data.paidAmount ?? Number(inv.paidAmount ?? 0);
        const balance = Math.max(0, Number(inv.total) - paidAmount);
        const updated = await prisma_1.prisma.invoice.update({ where: { id: inv.id }, data: { status: parsed.data.status, paidAmount, balance }, include: { customer: true } });
        res.json(updated);
    }
    catch (err) {
        console.error('PUT /invoices/:id/status error:', err);
        res.status(500).json({ error: 'Failed to update invoice status' });
    }
});
router.get('/:id/pdf', async (req, res) => {
    try {
        const inv = await prisma_1.prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!inv)
            return res.status(404).json({ error: 'Not found' });
        if (hasS3 && inv.pdfUrl) {
            const signed = signS3Url(inv.pdfUrl);
            if (signed) {
                res.setHeader('Cache-Control', 'no-store');
                return res.json({ url: signed });
            }
        }
        const itemsRaw = await prisma_1.prisma.invoiceItem.findMany({
            where: { invoiceId: inv.id },
            select: { name: true, qty: true, price: true },
            orderBy: { id: 'asc' },
        });
        const items = itemsRaw.map(i => ({ name: i.name, qty: i.qty, price: Number(i.price) }));
        const html = await buildInvoiceHtml({
            customerId: inv.customerId,
            items,
            subtotal: Number(inv.subtotal),
            tax: Number(inv.tax),
            discount: Number(inv.discount),
            total: Number(inv.total),
            invoiceNumber: inv.invoiceNumber,
            createdAt: inv.createdAt,
            dueDate: inv.dueDate ?? undefined,
        });
        const pdfBuffer = await (0, pdf_1.renderInvoicePDF)(html, env_1.env.PUPPETEER_EXECUTABLE_PATH);
        if (hasS3) {
            const key = `invoices/invoice-${inv.invoiceNumber}.pdf`;
            const location = await uploadToS3(key, pdfBuffer);
            await prisma_1.prisma.invoice.update({ where: { id: inv.id }, data: { pdfUrl: location } });
            const signed = signS3Url(location);
            if (!signed)
                throw new Error('Failed to sign S3 URL');
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ url: signed });
        }
        await ensureLocalDir();
        const outPath = localPdfPath(inv.id, inv.invoiceNumber);
        await promises_1.default.writeFile(outPath, pdfBuffer);
        const relUrl = localPdfUrl(inv.id);
        const absUrl = `${req.protocol}://${req.get('host')}${relUrl}`;
        if (inv.pdfUrl !== relUrl) {
            await prisma_1.prisma.invoice.update({ where: { id: inv.id }, data: { pdfUrl: relUrl } });
        }
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ url: absUrl });
    }
    catch (err) {
        console.error('GET /invoices/:id/pdf error:', err);
        return res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
});
exports.default = router;
//# sourceMappingURL=invoices.js.map