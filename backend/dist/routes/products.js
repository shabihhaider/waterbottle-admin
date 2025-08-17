"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const toUndef = (schema) => zod_1.z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);
const productSchema = zod_1.z.object({
    sku: zod_1.z.string().trim().min(1),
    name: zod_1.z.string().trim().min(1),
    urduName: toUndef(zod_1.z.string().trim()).optional(),
    description: toUndef(zod_1.z.string().trim()).optional(),
    brand: toUndef(zod_1.z.string().trim()).optional(),
    sizeLiters: zod_1.z.coerce.number().positive().default(1),
    type: zod_1.z.string().trim().min(1).default('GENERAL'),
    category: zod_1.z.string().trim().min(1).default('General'),
    costPrice: zod_1.z.coerce.number().nonnegative().default(0),
    salePrice: zod_1.z.coerce.number().nonnegative().default(0),
    imageUrl: toUndef(zod_1.z.string().url()).optional(),
    stock: zod_1.z.coerce.number().int().nonnegative().optional(),
    lowStockLevel: zod_1.z.coerce.number().int().nonnegative().default(10),
    supplierId: toUndef(zod_1.z.string()).optional(),
});
router.get('/', async (req, res, next) => {
    try {
        const { q, low, category, supplierId } = req.query;
        const where = {};
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
                { brand: { contains: q, mode: 'insensitive' } },
            ];
        }
        if (category)
            where.category = { contains: category, mode: 'insensitive' };
        if (supplierId)
            where.supplierId = supplierId;
        const products = await prisma_1.prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { supplier: true },
        });
        const list = low === '1' ? products.filter((p) => p.stock <= p.lowStockLevel) : products;
        res.json(list);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const p = await prisma_1.prisma.product.findUnique({ where: { id: req.params.id }, include: { supplier: true } });
        if (!p)
            return res.status(404).json({ message: 'Not found' });
        res.json(p);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const parsed = productSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const d = parsed.data;
        const created = await prisma_1.prisma.product.create({
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
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const parsed = productSchema.partial().safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const d = parsed.data;
        const updated = await prisma_1.prisma.product.update({
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
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/stock', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            change: zod_1.z.coerce.number().int(),
            reason: zod_1.z.string().min(1),
            note: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const { change, reason, note } = parsed.data;
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
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
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/movements', async (req, res, next) => {
    try {
        const items = await prisma_1.prisma.inventoryMovement.findMany({
            where: { productId: req.params.id },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json(items);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma_1.prisma.product.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map