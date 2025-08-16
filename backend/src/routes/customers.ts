// backend/src/routes/customers.ts (persisted fields)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
// Local types to avoid importing Prisma types
type CustomerStatusUI = 'active' | 'inactive' | 'vip';
type DbCustomerStatus = 'ACTIVE' | 'INACTIVE' | 'VIP';

// Minimal Customer shape used by shapeCustomer()
type CustomerModel = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
  status: DbCustomerStatus;
  rating: number | null;
  notes: string | null;
  creditLimit: unknown; // Prisma.Decimal | number; we coerce with Number()
};



const router = Router();
router.use(requireAuth);

// --- Zod schema accepts UI-friendly values, we'll coerce to DB types on write ---
const StatusUI = z.enum(['active', 'inactive', 'vip']);
const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  urduName: z.string().optional(),
  status: StatusUI.optional(),
  rating: z.coerce.number().int().min(0).max(5).optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
});

const toDbStatus = (s?: z.infer<typeof StatusUI>): DbCustomerStatus | undefined =>
   s ? (s.toUpperCase() as DbCustomerStatus) : undefined;
 const toUiStatus = (s: DbCustomerStatus) =>
   s.toLowerCase() as CustomerStatusUI;

// Shape DB -> UI model expected by the frontend Customers page
function shapeCustomer(
  c: CustomerModel,
  orderCount: number,
  lastOrderAt: Date | null,
  spent: number,
  outstanding: number
) {

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

// GET /api/customers?q=
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }
      : {} as any;

    const customers = await prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
    if (customers.length === 0) return res.json([]);

    const ids = customers.map((c) => c.id);

    const [ordersAgg, lastOrderAgg, invSpentAgg, invOutstandingAgg] = await Promise.all([
      prisma.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _count: { _all: true } }),
      prisma.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _max: { createdAt: true } }),
      prisma.invoice.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _sum: { total: true } }),
      prisma.invoice.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { balance: true } }),
    ]);

    const orderCountMap = new Map<string, number>(ordersAgg.map((o) => [o.customerId, o._count._all]));
    const lastOrderMap = new Map<string, Date | null>(lastOrderAgg.map((o) => [o.customerId, o._max.createdAt]));
    const spentMap = new Map<string, number>(invSpentAgg.map((i) => [i.customerId, Number(i._sum.total ?? 0)]));
    const outstandingMap = new Map<string, number>(invOutstandingAgg.map((i) => [i.customerId, Number(i._sum.balance ?? 0)]));

    const shaped = customers.map((c) =>
      shapeCustomer(
        c,
        orderCountMap.get(c.id) ?? 0,
        (lastOrderMap.get(c.id) as Date | null) ?? null,
        spentMap.get(c.id) ?? 0,
        outstandingMap.get(c.id) ?? 0
      )
    );

    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const c = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ message: 'Not found' });

    const [ordersAgg, lastOrderAgg, invSpentAgg, invOutstandingAgg] = await Promise.all([
      prisma.order.aggregate({ where: { customerId: c.id }, _count: { _all: true } }),
      prisma.order.aggregate({ where: { customerId: c.id }, _max: { createdAt: true } }),
      prisma.invoice.aggregate({ where: { customerId: c.id }, _sum: { total: true } }),
      prisma.invoice.aggregate({ where: { customerId: c.id, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { balance: true } }),
    ]);

    const shaped = shapeCustomer(
      c,
      Number(ordersAgg._count?._all ?? 0),
      (lastOrderAgg._max?.createdAt as Date | null) ?? null,
      Number(invSpentAgg._sum?.total ?? 0),
      Number(invOutstandingAgg._sum?.balance ?? 0)
    );

    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post('/', async (req, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const d = parsed.data;
    const created = await prisma.customer.create({
      data: {
        name: d.name,
        phone: d.phone ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        city: d.city ?? null,
        notes: d.notes ?? null,
        urduName: d.urduName ?? null,
        status: toDbStatus(d.status) ?? ('ACTIVE' as DbCustomerStatus),
        rating: d.rating ?? 0,
        creditLimit: d.creditLimit ?? 0,
      },
    });
    res.json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res, next) => {
  try {
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const d = parsed.data;
    const updated = await prisma.customer.update({
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
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
