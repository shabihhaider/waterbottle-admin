// =============================================
// File: backend/src/routes/deliveries.ts
// ---------------------------------------------
import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import type { Prisma, DeliveryStatus as PrismaDeliveryStatus, $Enums } from '@prisma/client';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const routerD = Router();
routerD.use(requireAuth);

// --- API <-> Prisma enum mapping ---
const DeliveryStatusApi = z.enum(['scheduled', 'out_for_delivery', 'delivered', 'failed']);
const toPrismaStatus = (s: z.infer<typeof DeliveryStatusApi>): PrismaDeliveryStatus => {
  switch (s) {
    case 'scheduled': return 'SCHEDULED';
    case 'out_for_delivery': return 'OUT_FOR_DELIVERY';
    case 'delivered': return 'DELIVERED';
    case 'failed': return 'FAILED';
  }
};
const fromPrismaStatus = (s: PrismaDeliveryStatus): z.infer<typeof DeliveryStatusApi> => {
  switch (s) {
    case 'SCHEDULED': return 'scheduled';
    case 'OUT_FOR_DELIVERY': return 'out_for_delivery';
    case 'DELIVERED': return 'delivered';
    case 'FAILED': return 'failed';
  }
};

// Common include map to match frontend shape
const includeDelivery = {
  order: { select: { id: true, orderNumber: true, customer: { select: { id: true, name: true, address: true } } } },
  driver: { select: { id: true, name: true, phone: true } },
} as const;

// ---------- GET /api/deliveries ----------
routerD.get('/', async (req, res, next) => {
  try {
    const { q, status: statusParam, driverId, from, to } = req.query as {
      q?: string; status?: string; driverId?: string; from?: string; to?: string;
    };

    const where: Prisma.DeliveryWhereInput = {};

    if (driverId) where.driverId = driverId;

    if (statusParam && DeliveryStatusApi.safeParse(statusParam).success) {
      where.status = toPrismaStatus(statusParam as any);
    }

    if (from || to) {
      const gte = from ? new Date(from) : undefined;
      const lte = to ? dayjs(String(to)).endOf('day').toDate() : undefined;
      where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }

    if (q && q.trim()) {
      const num = Number(q);
      const or: Prisma.DeliveryWhereInput['OR'] = [
        ...(Number.isFinite(num) ? [{ deliveryNumber: num }, { order: { orderNumber: num } }] : []),
        { order: { customer: { name: { contains: q, mode: 'insensitive' } } } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
      where.OR = or;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: includeDelivery,
    });

    const json = deliveries.map((d) => ({ ...d, status: fromPrismaStatus(d.status) }));
    res.json(json);
  } catch (err) {
    next(err);
  }
});

// ---------- helpers ----------
const isoOrLocal = (v?: string | null): Date | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = dayjs(v);
  return d.isValid() ? d.toDate() : undefined;
};

// ---------- POST /api/deliveries ----------
routerD.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      orderId: z.string().min(1),
      driverId: z.string().optional(),
      scheduledDate: z.string().optional(), // accept datetime-local
      notes: z.string().optional(),
      address: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });

    const { orderId, driverId, scheduledDate, notes, address } = parsed.data;

    // ✅ Do NOT return res from inside the transaction
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

    const created = await prisma.$transaction(async (tx) => {
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
  } catch (err) {
    next(err);
  }
});

// ---------- PUT /api/deliveries/:id (assign/update meta) ----------
routerD.put('/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      driverId: z.string().nullable().optional(),
      scheduledDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });

    const { driverId, scheduledDate, notes, address } = parsed.data;

    const data: Prisma.DeliveryUpdateInput = {
      ...(driverId === undefined
        ? {}
        : driverId === null || driverId === ''
        ? { driver: { disconnect: true } }
        : { driver: { connect: { id: driverId } } }),
      ...(scheduledDate !== undefined ? { scheduledDate: isoOrLocal(scheduledDate) ?? null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(address !== undefined ? { address } : {}),
    };

    const upd = await prisma.delivery.update({
      where: { id: req.params.id },
      data,
      include: includeDelivery,
    });

    const json = { ...upd, status: fromPrismaStatus(upd.status) };
    res.json(json);
  } catch (err) {
    next(err);
  }
});

// ---------- PUT /api/deliveries/:id/status ----------
routerD.put('/:id/status', async (req, res, next) => {
  try {
    const parsed = z.object({ status: DeliveryStatusApi }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });

    const nextStatus = parsed.data.status;
    const prismaStatus = toPrismaStatus(nextStatus);

    // ✅ Guard OUTSIDE the transaction so we don't return a Response from inside it
    const existing = await prisma.delivery.findUnique({ where: { id: req.params.id }, include: { order: true } });
    if (!existing) return res.status(404).json({ error: 'DELIVERY_NOT_FOUND' });

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.delivery.update({
        where: { id: existing.id },
        data: {
          status: prismaStatus,
          deliveredAt: prismaStatus === 'DELIVERED' ? new Date() : existing.deliveredAt,
        },
        include: includeDelivery,
      });

      const orderStatusMap: Record<PrismaDeliveryStatus, $Enums.OrderStatus> = {
        SCHEDULED: 'SCHEDULED',
        OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
        DELIVERED: 'DELIVERED',
        FAILED: 'PENDING', // allow reschedule on failure
      };
      await tx.order.update({ where: { id: existing.orderId }, data: { status: orderStatusMap[prismaStatus] } });

      return upd;
    });

    const json = { ...updated, status: fromPrismaStatus(updated.status) };
    res.json(json);
  } catch (err) {
    next(err);
  }
});

export default routerD;
