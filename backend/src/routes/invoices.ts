// backend/src/routes/invoices.ts — replace file

import AWS from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { invoiceHtmlTemplate } from '../templates/invoice';
import { renderInvoicePDF } from '../services/pdf';
import { env } from '../env';
import bcrypt from 'bcryptjs';

const isDev = process.env.NODE_ENV !== 'production';
const allowDevBypass =
  isDev || String(process.env.ALLOW_DEV_AUTH || '').toLowerCase() === 'true';

const router = Router();

// ──────────────────────────────────────────────
// Storage setup (S3 or Local)
// ──────────────────────────────────────────────
const S3_BUCKET = env.S3_BUCKET || '';
const hasS3 = Boolean(
  S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
);

const s3 = hasS3
  ? new AWS.S3({
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION,
    })
  : null;

const LOCAL_DIR = path.resolve(process.cwd(), 'storage', 'invoices');
async function ensureLocalDir() { if (!hasS3) await fs.mkdir(LOCAL_DIR, { recursive: true }); }
const localPdfPath = (id: string, no: number | string) => path.join(LOCAL_DIR, `invoice-${no}-${id}.pdf`);
const localPdfUrl  = (id: string) => `/api/invoices/${id}/pdf/raw`;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const NumberLike = z.coerce.number();

const CreateSchema = z.object({
  customerId: z.string(),
  orderId: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    qty: z.coerce.number().int().positive(),
    price: z.coerce.number().nonnegative(),
  })).min(1),
  tax: NumberLike.nonnegative().default(0),
  discount: NumberLike.nonnegative().default(0),
  dueDate: z.string().optional(), // "YYYY-MM-DD" or ""
  notes: z.string().optional(),
});

const parseDueDate = (d?: string) => (d && d.trim() ? (isNaN(new Date(`${d}T00:00:00`).getTime()) ? undefined : new Date(`${d}T00:00:00`)) : undefined);

async function ensureUserExists(email: string) {
  let u = await prisma.user.findUnique({ where: { email } });
  if (!u) {
    const passwordHash = await bcrypt.hash('dev123', 10);
    u = await prisma.user.create({ data: { email, name: 'Dev Admin', role: 'ADMIN', passwordHash } });
  }
  return u;
}

async function resolveUserId(req: any): Promise<string> {
  // 1) If middleware attached a user and it exists → use it
  const hinted = req?.user?.id as string | undefined;
  if (hinted) {
    const u = await prisma.user.findUnique({ where: { id: hinted } });
    if (u) return u.id;
  }

  // 2) Env overrides (handy on prod/dev servers)
  const envId = process.env.DEFAULT_USER_ID;
  if (envId) {
    const u = await prisma.user.findUnique({ where: { id: envId } });
    if (u) return u.id;
  }
  const envEmail = process.env.SYSTEM_USER_EMAIL || process.env.DEFAULT_USER_EMAIL;
  if (envEmail) {
    const u = await prisma.user.findUnique({ where: { email: envEmail } });
    if (u) return u.id;
  }

  // 3) First user in DB if any
  const first = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (first) return first.id;

  // 4) As a last resort (dev), create a user so FKs are satisfied
  const devEmail = process.env.SYSTEM_USER_EMAIL || 'dev@local.test';
  const passwordHash = await bcrypt.hash('dev123', 10);
  const created = await prisma.user.create({
    data: { email: devEmail, name: 'Dev Admin', role: 'ADMIN', passwordHash },
  });
  return created.id;
}

async function buildInvoiceHtml(inv: { customerId: string; items: { name: string; qty: number; price: number }[]; subtotal: number; tax: number; discount: number; total: number; invoiceNumber: number | string; createdAt: Date; dueDate?: Date | null; }) {
  const customer = await prisma.customer.findUnique({ where: { id: inv.customerId } });
  return invoiceHtmlTemplate({
    company: { name: 'HydroPak Pvt. Ltd.', address: 'Lahore, Pakistan', phone: '+92 300 0000000' },
    customer: { name: customer?.name || 'Customer', address: customer?.address ?? '', phone: customer?.phone ?? '' },
    items: inv.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, total: i.qty * i.price })),
    summary: { subtotal: inv.subtotal, tax: inv.tax, discount: inv.discount, total: inv.total, invoiceNumber: String(inv.invoiceNumber) },
    meta: { issueDate: inv.createdAt, dueDate: inv.dueDate ?? undefined },
  });
}

async function uploadToS3(key: string, body: Buffer) {
  if (!s3) throw new Error('S3 not configured');
  const up = await s3.upload({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: 'application/pdf', ACL: 'private' }).promise();
  return up.Location;
}

function signS3Url(location: string) {
  if (!s3) return null;
  try {
    const u = new URL(location); const Key = u.pathname.replace(/^\//, '');
    return s3.getSignedUrl('getObject', { Bucket: S3_BUCKET, Key, Expires: 600, ResponseContentDisposition: 'inline', ResponseContentType: 'application/pdf' });
  } catch { return null; }
}

// ──────────────────────────────────────────────
// DEV-ONLY: raw streaming without auth so a new tab can open
// ──────────────────────────────────────────────
router.get('/:id/pdf/raw', async (req, res) => {
  try {
    if (hasS3) return res.status(404).json({ error: 'Not available with S3' });
    if (!allowDevBypass) return res.status(401).json({ error: 'Unauthorized' });

    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const p = localPdfPath(inv.id, inv.invoiceNumber);
    try { await fs.access(p); } catch { return res.status(404).json({ error: 'PDF not generated yet' }); }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="invoice.pdf"');
    const buf = await fs.readFile(p);
    res.end(buf);
  } catch (err) {
    console.error('GET /invoices/:id/pdf/raw error:', err);
    res.status(500).json({ error: 'Failed to stream PDF' });
  }
});

// All routes below require auth
router.use(requireAuth);

// List
router.get('/', async (_req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' } });
    res.json(invoices);
  } catch (err) {
    console.error('GET /invoices error:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { customer: true } });
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch (err) {
    console.error('GET /invoices/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create (persist Invoice + InvoiceItem; PDF is deferred)
router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { customerId, orderId, items, tax, discount, dueDate } = parsed.data;
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const total = subtotal + tax - discount;
    const ownerId = await resolveUserId(req);
    const due = parseDueDate(dueDate);

    const invoice = await prisma.$transaction(async (tx) => {
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
  } catch (err) {
    console.error('POST /invoices error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update status
router.put('/:id/status', async (req, res) => {
  const schema = z.object({ status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']), paidAmount: z.coerce.number().nonnegative().optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const paidAmount = parsed.data.paidAmount ?? Number(inv.paidAmount ?? 0);
    const balance = Math.max(0, Number(inv.total) - paidAmount);

    const updated = await prisma.invoice.update({ where: { id: inv.id }, data: { status: parsed.data.status, paidAmount, balance }, include: { customer: true } });
    res.json(updated);
  } catch (err) {
    console.error('PUT /invoices/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// Return a URL to open/print the invoice PDF
// Return a URL to open/print the invoice PDF (absolute URL to avoid `/api/api` dup)
router.get('/:id/pdf', async (req, res) => {
  try {
    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!inv) return res.status(404).json({ error: 'Not found' });

    // If already on S3, hand back a fresh signed URL
    if (hasS3 && inv.pdfUrl) {
      const signed = signS3Url(inv.pdfUrl);
      if (signed) {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ url: signed });
      }
    }

    // Fetch items (Decimal -> number) with stable order
    const itemsRaw = await prisma.invoiceItem.findMany({
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

    const pdfBuffer = await renderInvoicePDF(html, env.PUPPETEER_EXECUTABLE_PATH);

    if (hasS3) {
      const key = `invoices/invoice-${inv.invoiceNumber}.pdf`;
      const location = await uploadToS3(key, pdfBuffer);
      await prisma.invoice.update({ where: { id: inv.id }, data: { pdfUrl: location } });
      const signed = signS3Url(location);
      if (!signed) throw new Error('Failed to sign S3 URL');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ url: signed });
    }

    // Local file output + absolute URL to prevent `/api/api/...` in the frontend
    await ensureLocalDir();
    const outPath = localPdfPath(inv.id, inv.invoiceNumber);
    await fs.writeFile(outPath, pdfBuffer);

    const relUrl = localPdfUrl(inv.id); // e.g. `/api/invoices/:id/pdf/raw`
    const absUrl = `${req.protocol}://${req.get('host')}${relUrl}`;

    if (inv.pdfUrl !== relUrl) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { pdfUrl: relUrl } });
    }

    // Avoid cached 304s on repeat clicks of "Print/Generate PDF"
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ url: absUrl });
  } catch (err) {
    console.error('GET /invoices/:id/pdf error:', err);
    return res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});


export default router;
