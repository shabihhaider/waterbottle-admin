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
const routerD = (0, express_1.Router)();
routerD.use(auth_1.requireAuth);
const DeliveryStatusApi = zod_1.z.enum(['scheduled', 'out_for_delivery', 'delivered', 'failed']);
const toPrismaStatus = (s) => {
    switch (s) {
        case 'scheduled': return 'SCHEDULED';
        case 'out_for_delivery': return 'OUT_FOR_DELIVERY';
        case 'delivered': return 'DELIVERED';
        case 'failed': return 'FAILED';
    }
};
const fromPrismaStatus = (s) => {
    switch (s) {
        case 'SCHEDULED': return 'scheduled';
        case 'OUT_FOR_DELIVERY': return 'out_for_delivery';
        case 'DELIVERED': return 'delivered';
        case 'FAILED': return 'failed';
    }
};
const includeDelivery = {
    order: { select: { id: true, orderNumber: true, customer: { select: { id: true, name: true, address: true } } } },
    driver: { select: { id: true, name: true, phone: true } },
};
routerD.get('/', async (req, res, next) => {
    try {
        const { q, status: statusParam, driverId, from, to } = req.query;
        const where = {};
        if (driverId)
            where.driverId = driverId;
        if (statusParam && DeliveryStatusApi.safeParse(statusParam).success) {
            where.status = toPrismaStatus(statusParam);
        }
        if (from || to) {
            const gte = from ? new Date(from) : undefined;
            const lte = to ? (0, dayjs_1.default)(String(to)).endOf('day').toDate() : undefined;
            where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
        }
        if (q && q.trim()) {
            const num = Number(q);
            const or = [
                ...(Number.isFinite(num) ? [{ deliveryNumber: num }, { order: { orderNumber: num } }] : []),
                { order: { customer: { name: { contains: q, mode: 'insensitive' } } } },
                { address: { contains: q, mode: 'insensitive' } },
            ];
            where.OR = or;
        }
        const deliveries = await prisma_1.prisma.delivery.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: includeDelivery,
        });
        const json = deliveries.map((d) => ({ ...d, status: fromPrismaStatus(d.status) }));
        res.json(json);
    }
    catch (err) {
        next(err);
    }
});
const isoOrLocal = (v) => {
    if (v === undefined)
        return undefined;
    if (v === null || v === '')
        return null;
    const d = (0, dayjs_1.default)(v);
    return d.isValid() ? d.toDate() : undefined;
};
routerD.post('/', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            orderId: zod_1.z.string().min(1),
            driverId: zod_1.z.string().optional(),
            scheduledDate: zod_1.z.string().optional(),
            notes: zod_1.z.string().optional(),
            address: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
        const { orderId, driverId, scheduledDate, notes, address } = parsed.data;
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: true },
        });
        if (!order)
            return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        const created = await prisma_1.prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.create({
                data: {
                    order: { connect: { id: orderId } },
                    ...(driverId ? { driver: { connect: { id: driverId } } } : {}),
                    scheduledDate: isoOrLocal(scheduledDate) ?? null,
                    notes: notes || null,
                    address: address || order.customer?.address || null,
                    status: 'SCHEDULED',
                },
                include: includeDelivery,
            });
            if (order.status === 'PENDING') {
                await tx.order.update({ where: { id: order.id }, data: { status: 'SCHEDULED' } });
            }
            return delivery;
        });
        const json = { ...created, status: fromPrismaStatus(created.status) };
        res.status(201).json(json);
    }
    catch (err) {
        next(err);
    }
});
routerD.put('/:id', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            driverId: zod_1.z.string().nullable().optional(),
            scheduledDate: zod_1.z.string().nullable().optional(),
            notes: zod_1.z.string().nullable().optional(),
            address: zod_1.z.string().nullable().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
        const { driverId, scheduledDate, notes, address } = parsed.data;
        const data = {
            ...(driverId === undefined
                ? {}
                : driverId === null || driverId === ''
                    ? { driver: { disconnect: true } }
                    : { driver: { connect: { id: driverId } } }),
            ...(scheduledDate !== undefined ? { scheduledDate: isoOrLocal(scheduledDate) ?? null } : {}),
            ...(notes !== undefined ? { notes } : {}),
            ...(address !== undefined ? { address } : {}),
        };
        const upd = await prisma_1.prisma.delivery.update({
            where: { id: req.params.id },
            data,
            include: includeDelivery,
        });
        const json = { ...upd, status: fromPrismaStatus(upd.status) };
        res.json(json);
    }
    catch (err) {
        next(err);
    }
});
routerD.put('/:id/status', async (req, res, next) => {
    try {
        const parsed = zod_1.z.object({ status: DeliveryStatusApi }).safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
        const nextStatus = parsed.data.status;
        const prismaStatus = toPrismaStatus(nextStatus);
        const existing = await prisma_1.prisma.delivery.findUnique({ where: { id: req.params.id }, include: { order: true } });
        if (!existing)
            return res.status(404).json({ error: 'DELIVERY_NOT_FOUND' });
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const upd = await tx.delivery.update({
                where: { id: existing.id },
                data: {
                    status: prismaStatus,
                    deliveredAt: prismaStatus === 'DELIVERED' ? new Date() : existing.deliveredAt,
                },
                include: includeDelivery,
            });
            const orderStatusMap = {
                SCHEDULED: 'SCHEDULED',
                OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
                DELIVERED: 'DELIVERED',
                FAILED: 'PENDING',
            };
            await tx.order.update({ where: { id: existing.orderId }, data: { status: orderStatusMap[prismaStatus] } });
            return upd;
        });
        const json = { ...updated, status: fromPrismaStatus(updated.status) };
        res.json(json);
    }
    catch (err) {
        next(err);
    }
});
exports.default = routerD;
//# sourceMappingURL=deliveries.js.map