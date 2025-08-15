// backend/src/routes/orders.ts (aligned with schema + frontend)
import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import type { Prisma } from '@prisma/client';

const router = Router();
router.use(requireAuth);

// ----- Schemas -----
const OrderStatusEnum = z.enum(['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);

const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const orderCreateSchema = z.object({
  customerId: z.string(),
  items: z.array(orderItemSchema).min(1),
  scheduledAt: z.string().datetime().optional(),
  routeCode: z.string().optional(),
  // allow providing an initial status (defaults to PENDING)
  status: OrderStatusEnum.optional(),
});

const orderUpdateSchema = z.object({
  scheduledAt: z.string().datetime().nullable().optional(),
  routeCode: z.string().nullable().optional(),
});

// ----- Helpers -----
function includeForOrder() {
  return {
    customer: true,
    items: { include: { product: true } },
    invoice: true,
  } as const;
}

// ----- GET /api/orders -----
// Supports filters: q, status, from, to, customerId
// Special: status=confirmed -> treat as orders that are ready (PENDING or SCHEDULED)
router.get('/', async (req, res, next) => {
  try {
    const { q, status, from, to, customerId } = req.query as {
      q?: string;
      status?: string;
      from?: string; // ISO date
      to?: string;   // ISO date
      customerId?: string;
    };

    const where: Prisma.OrderWhereInput = {};

    if (customerId) where.customerId = customerId;

    if (status) {
      if (status === 'confirmed') {
        // Frontend deliveries page calls /orders?status=confirmed to fetch ready-to-deliver orders
        where.status = { in: ['PENDING', 'SCHEDULED'] } as any;
      } else if (OrderStatusEnum.safeParse(status).success) {
        where.status = status as any;
      }
    }

    if (from || to) {
      const gte = from ? new Date(from) : undefined;
      const lte = to ? dayjs(to).endOf('day').toDate() : undefined;
      where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }

    if (q) {
      const asNumber = Number(q);
      // Search by orderNumber exact or customer name partial
      where.OR = [
        ...(Number.isFinite(asNumber) ? [{ orderNumber: asNumber as number }] : []),
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: includeForOrder(),
    });

    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// ----- GET /api/orders/:id -----
router.get('/:id', async (req, res, next) => {
  try {
    const o = await prisma.order.findUnique({ where: { id: req.params.id }, include: includeForOrder() });
    if (!o) return res.status(404).json({ message: 'Not found' });
    res.json(o);
  } catch (err) {
    next(err);
  }
});

// ----- POST /api/orders -----
router.post('/', async (req, res, next) => {
  try {
    const parsed = orderCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { customerId, items, scheduledAt, routeCode, status } = parsed.data;

    const authUser = await prisma.user.findUnique({
      where: { id: req.user?.id ?? '' },
    });
    const userId = authUser?.id ?? null;

    // Create order + decrement stock + log inventory movements atomically
    const order = await prisma.$transaction(async (tx) => {
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
        // If unitPrice omitted for any reason, fall back to product.salePrice
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product) throw new Error('PRODUCT_NOT_FOUND');
        const unitPrice = typeof it.unitPrice === 'number' ? it.unitPrice : Number(product.salePrice);

        await tx.orderItem.create({
          data: { orderId: o.id, productId: it.productId, quantity: it.quantity, unitPrice },
        });

        // Allow negative stock (backorder) similar to previous behavior
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

    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: includeForOrder(),
    });

    res.json(full);
  } catch (err) {
    next(err);
  }
});

// ----- PUT /api/orders/:id  (update schedule/route)
router.put('/:id', async (req, res, next) => {
  try {
    const parsed = orderUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { scheduledAt, routeCode } = parsed.data;

    const upd = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
        ...(routeCode !== undefined ? { routeCode } : {}),
      },
      include: includeForOrder(),
    });

    res.json(upd);
  } catch (err) {
    next(err);
  }
});

// ----- PUT /api/orders/:id/status -----
router.put('/:id/status', async (req, res, next) => {
  try {
    const parsed = z.object({ status: OrderStatusEnum }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const nextStatus = parsed.data.status;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!existing) throw new Error('ORDER_NOT_FOUND');

      // If cancelling and previous was not CANCELLED, restock items
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
  } catch (err) {
    next(err);
  }
});

export default router;
