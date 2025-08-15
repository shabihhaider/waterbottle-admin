// backend/src/routes/products.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import type { Prisma } from '@prisma/client';

const router = Router();
router.use(requireAuth);

// Product payload validation (matches Prisma schema)

const toUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

const productSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),

  urduName: toUndef(z.string().trim()).optional(),
  description: toUndef(z.string().trim()).optional(),
  brand: toUndef(z.string().trim()).optional(),

  // UI doesn't send these → provide safe defaults
  sizeLiters: z.coerce.number().positive().default(1),
  type: z.string().trim().min(1).default('GENERAL'),

  // Allow blank and default
  category: z.string().trim().min(1).default('General'),

  costPrice: z.coerce.number().nonnegative().default(0),
  salePrice: z.coerce.number().nonnegative().default(0),

  // Treat empty string as undefined so URL validation doesn't fail
  imageUrl: toUndef(z.string().url()).optional(),

  stock: z.coerce.number().int().nonnegative().optional(),
  lowStockLevel: z.coerce.number().int().nonnegative().default(10),

  // Accept blank/undefined
  supplierId: toUndef(z.string()).optional(),
});


// GET /api/products?q= & low=1 & category= & supplierId=
router.get('/', async (req, res, next) => {
  try {
    const { q, low, category, supplierId } = req.query as {
      q?: string;
      low?: string; // '1' to show only low stock
      category?: string;
      supplierId?: string;
    };

    const where: Prisma.ProductWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (supplierId) where.supplierId = supplierId;

    // We cannot express "stock <= lowStockLevel" in Prisma filters directly.
    // So fetch and filter in-memory when low=1.
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { supplier: true },
    });

    const list = low === '1' ? products.filter((p) => p.stock <= p.lowStockLevel) : products;

    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: { supplier: true } });
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post('/', async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const d = parsed.data;

    const created = await prisma.product.create({
      data: {
        sku: d.sku,
        name: d.name,
        urduName: d.urduName ?? null,
        description: d.description ?? null,
        brand: d.brand ?? null,
        sizeLiters: d.sizeLiters,
        type: d.type,
        category: d.category,
        costPrice: d.costPrice,
        salePrice: d.salePrice,
        imageUrl: d.imageUrl ?? null,
        stock: d.stock ?? 0,
        lowStockLevel: d.lowStockLevel,
        supplierId: d.supplierId ?? null,
      },
    });

    res.json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res, next) => {
  try {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const d = parsed.data;

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(d.sku !== undefined ? { sku: d.sku } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.urduName !== undefined ? { urduName: d.urduName ?? null } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
        ...(d.brand !== undefined ? { brand: d.brand ?? null } : {}),
        ...(d.sizeLiters !== undefined ? { sizeLiters: d.sizeLiters } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.category !== undefined ? { category: d.category } : {}),
        ...(d.costPrice !== undefined ? { costPrice: d.costPrice } : {}),
        ...(d.salePrice !== undefined ? { salePrice: d.salePrice } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl ?? null } : {}),
        ...(d.stock !== undefined ? { stock: d.stock } : {}),
        ...(d.lowStockLevel !== undefined ? { lowStockLevel: d.lowStockLevel } : {}),
        ...(d.supplierId !== undefined ? { supplierId: d.supplierId ?? null } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/stock  (adjust stock + inventory movement log)
router.post('/:id/stock', async (req, res, next) => {
  try {
    const schema = z.object({
      change: z.coerce.number().int(), // can be negative
      reason: z.string().min(1),
      note: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { change, reason, note } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: req.params.id },
        data: { stock: { increment: change } },
      });

      await tx.inventoryMovement.create({
        data: { productId: p.id, change, reason, note: note ?? null },
      });

      return p;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/movements  — history for the inventory drawer
router.get('/:id/movements', async (req, res, next) => {
  try {
    const items = await prisma.inventoryMovement.findMany({
      where: { productId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
