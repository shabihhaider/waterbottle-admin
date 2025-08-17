"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const StatusUI = zod_1.z.enum(['active', 'inactive', 'vip']);
const customerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    urduName: zod_1.z.string().optional(),
    status: StatusUI.optional(),
    rating: zod_1.z.coerce.number().int().min(0).max(5).optional(),
    creditLimit: zod_1.z.coerce.number().nonnegative().optional(),
});
const toDbStatus = (s) => s ? s.toUpperCase() : undefined;
const toUiStatus = (s) => s.toLowerCase();
function shapeCustomer(c, orderCount, lastOrderAt, spent, outstanding) {
    return {
        id: c.id,
        name: c.name,
        phone: c.phone ?? undefined,
        email: c.email ?? undefined,
        address: c.address ?? undefined,
        totalOrders: orderCount,
        totalSpent: spent,
        lastOrderDate: lastOrderAt ? new Date(lastOrderAt).toISOString() : undefined,
        status: toUiStatus(c.status),
        rating: c.rating ?? 0,
        joinDate: new Date(c.createdAt).toISOString(),
        notes: c.notes ?? undefined,
        creditLimit: Number(c.creditLimit ?? 0),
        outstandingBalance: outstanding,
    };
}
router.get('/', async (req, res, next) => {
    try {
        const { q } = req.query;
        const where = q
            ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q } },
                    { email: { contains: q, mode: 'insensitive' } },
                ],
            }
            : {};
        const customers = await prisma_1.prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
        if (customers.length === 0)
            return res.json([]);
        const ids = customers.map((c) => c.id);
        const [ordersAgg, lastOrderAgg, invSpentAgg, invOutstandingAgg] = await Promise.all([
            prisma_1.prisma.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _count: { _all: true } }),
            prisma_1.prisma.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _max: { createdAt: true } }),
            prisma_1.prisma.invoice.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _sum: { total: true } }),
            prisma_1.prisma.invoice.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { balance: true } }),
        ]);
        const orderCountMap = new Map(ordersAgg.map((o) => [o.customerId, o._count._all]));
        const lastOrderMap = new Map(lastOrderAgg.map((o) => [o.customerId, o._max.createdAt]));
        const spentMap = new Map(invSpentAgg.map((i) => [i.customerId, Number(i._sum.total ?? 0)]));
        const outstandingMap = new Map(invOutstandingAgg.map((i) => [i.customerId, Number(i._sum.balance ?? 0)]));
        const shaped = customers.map((c) => shapeCustomer(c, orderCountMap.get(c.id) ?? 0, lastOrderMap.get(c.id) ?? null, spentMap.get(c.id) ?? 0, outstandingMap.get(c.id) ?? 0));
        res.json(shaped);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const c = await prisma_1.prisma.customer.findUnique({ where: { id: req.params.id } });
        if (!c)
            return res.status(404).json({ message: 'Not found' });
        const [ordersAgg, lastOrderAgg, invSpentAgg, invOutstandingAgg] = await Promise.all([
            prisma_1.prisma.order.aggregate({ where: { customerId: c.id }, _count: { _all: true } }),
            prisma_1.prisma.order.aggregate({ where: { customerId: c.id }, _max: { createdAt: true } }),
            prisma_1.prisma.invoice.aggregate({ where: { customerId: c.id }, _sum: { total: true } }),
            prisma_1.prisma.invoice.aggregate({ where: { customerId: c.id, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { balance: true } }),
        ]);
        const shaped = shapeCustomer(c, Number(ordersAgg._count?._all ?? 0), lastOrderAgg._max?.createdAt ?? null, Number(invSpentAgg._sum?.total ?? 0), Number(invOutstandingAgg._sum?.balance ?? 0));
        res.json(shaped);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const parsed = customerSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const d = parsed.data;
        const created = await prisma_1.prisma.customer.create({
            data: {
                name: d.name,
                phone: d.phone ?? null,
                email: d.email ?? null,
                address: d.address ?? null,
                city: d.city ?? null,
                notes: d.notes ?? null,
                urduName: d.urduName ?? null,
                status: toDbStatus(d.status) ?? 'ACTIVE',
                rating: d.rating ?? 0,
                creditLimit: d.creditLimit ?? 0,
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
        const parsed = customerSchema.partial().safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten() });
        const d = parsed.data;
        const updated = await prisma_1.prisma.customer.update({
            where: { id: req.params.id },
            data: {
                ...(d.name !== undefined ? { name: d.name } : {}),
                ...(d.phone !== undefined ? { phone: d.phone ?? null } : {}),
                ...(d.email !== undefined ? { email: d.email ?? null } : {}),
                ...(d.address !== undefined ? { address: d.address ?? null } : {}),
                ...(d.city !== undefined ? { city: d.city ?? null } : {}),
                ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
                ...(d.urduName !== undefined ? { urduName: d.urduName ?? null } : {}),
                ...(d.status !== undefined ? { status: toDbStatus(d.status) } : {}),
                ...(d.rating !== undefined ? { rating: d.rating } : {}),
                ...(d.creditLimit !== undefined ? { creditLimit: d.creditLimit } : {}),
            },
        });
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma_1.prisma.customer.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=customers.js.map