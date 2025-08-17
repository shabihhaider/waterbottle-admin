"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const OrderStatusEnum = zod_1.z.enum(['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);
const orderItemSchema = zod_1.z.object({
    productId: zod_1.z.string(),
    quantity: zod_1.z.coerce.number().int().positive(),
    unitPrice: zod_1.z.coerce.number().nonnegative(),
});
const orderCreateSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    items: zod_1.z.array(orderItemSchema).min(1),
    scheduledAt: zod_1.z.string().datetime().optional(),
    routeCode: zod_1.z.string().optional(),
    status: OrderStatusEnum.optional(),
});
const orderUpdateSchema = zod_1.z.object({
    scheduledAt: zod_1.z.string().datetime().nullable().optional(),
    routeCode: zod_1.z.string().nullable().optional(),
});
function includeForOrder() {
    return {
        customer: true,
        items: { include: { product: true } },
        invoice: true,
    };
}
router.get('/', async (req, res, next) => {
    try {
        const { q, status, from, to, customerId } = req.query;
        const where = {};
        if (customerId)
            where.customerId = customerId;
        if (status) {
            if (status === 'confirmed') {
                where.status = { in: ['PENDING', 'SCHEDULED'] };
            }
            else if (OrderStatusEnum.safeParse(status).success) {
                where.status = status;
            }
        }
        if (from || to) {
            const gte = from ? new Date(from) : undefined;
            const lte = to ? (0, dayjs_1.default)(to).endOf('day').toDate() : undefined;
            where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
        }
        if (q) {
            const asNumber = Number(q);
            where.OR = [
                ...(Number.isFinite(asNumber) ? [{ orderNumber: asNumber }] : []),
                { customer: { name: { contains: q, mode: 'insensitive' } } },
            ];
        }
        const orders = await prisma_1.prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: includeForOrder(),
        });
        res.json(orders);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const o = await prisma_1.prisma.order.findUnique({ where: { id: req.params.id }, include: includeForOrder() });
        if (!o)
            return res.status(404).json({ message: 'Not found' });
        res.json(o);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const parsed = orderCreateSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const { customerId, items, scheduledAt, routeCode, status } = parsed.data;
        const authUser = await prisma_1.prisma.user.findUnique({
            where: { id: req.user?.id ?? '' },
        });
        const userId = authUser?.id ?? null;
        const order = await prisma_1.prisma.$transaction(async (tx) => {
            const o = await tx.order.create({
                data: {
                    customerId,
                    userId,
                    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                    routeCode: routeCode ?? null,
                    status: status ?? 'PENDING',
                },
            });
            for (const it of items) {
                const product = await tx.product.findUnique({ where: { id: it.productId } });
                if (!product)
                    throw new Error('PRODUCT_NOT_FOUND');
                const unitPrice = typeof it.unitPrice === 'number' ? it.unitPrice : Number(product.salePrice);
                await tx.orderItem.create({
                    data: { orderId: o.id, productId: it.productId, quantity: it.quantity, unitPrice },
                });
                await tx.product.update({
                    where: { id: it.productId },
                    data: { stock: { decrement: it.quantity } },
                });
                await tx.inventoryMovement.create({
                    data: { productId: it.productId, change: -it.quantity, reason: 'sale', note: `order:${o.orderNumber}` },
                });
            }
            return o;
        });
        const full = await prisma_1.prisma.order.findUnique({
            where: { id: order.id },
            include: includeForOrder(),
        });
        res.json(full);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const parsed = orderUpdateSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const { scheduledAt, routeCode } = parsed.data;
        const upd = await prisma_1.prisma.order.update({
            where: { id: req.params.id },
            data: {
                ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
                ...(routeCode !== undefined ? { routeCode } : {}),
            },
            include: includeForOrder(),
        });
        res.json(upd);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id/status', async (req, res, next) => {
    try {
        const parsed = zod_1.z.object({ status: OrderStatusEnum }).safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const nextStatus = parsed.data.status;
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: req.params.id },
                include: { items: true },
            });
            if (!existing)
                throw new Error('ORDER_NOT_FOUND');
            if (nextStatus === 'CANCELLED' && existing.status !== 'CANCELLED') {
                for (const it of existing.items) {
                    await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
                    await tx.inventoryMovement.create({
                        data: { productId: it.productId, change: it.quantity, reason: 'cancel', note: `order:${existing.orderNumber}` },
                    });
                }
            }
            return tx.order.update({ where: { id: existing.id }, data: { status: nextStatus }, include: includeForOrder() });
        });
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map