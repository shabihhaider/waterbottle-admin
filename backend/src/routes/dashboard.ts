// backend/src/routes/dashboard.ts
import { Router } from 'express';
import dayjs from 'dayjs';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../prisma'; // <- use your existing helper
type OrderStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

const router = Router();
router.use(requireAuth);

// Helpers
const fmtMonth = (d: Date) => dayjs(d).format('MMM YY');
const startOfDay = (d = new Date()) => dayjs(d).startOf('day').toDate();
const addDays = (d: Date, n: number) => dayjs(d).add(n, 'day').toDate();
const clampPercent = (n: number) => (Number.isFinite(n) ? Math.max(-999, Math.min(999, n)) : 0);

router.get('/metrics', async (_req, res, next) => {
  try {
    // --- Totals -------------------------------------------------------------
    const [revenueAgg, outstandingAgg, customers, products, orders] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true }, where: { status: { in: ['PAID', 'PENDING', 'OVERDUE'] } } }),
      prisma.invoice.aggregate({ _sum: { balance: true }, where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.order.count(),
    ]);

    const revenue = Number(revenueAgg._sum.total ?? 0);
    const outstanding = Number(outstandingAgg._sum.balance ?? 0);

    // --- Monthly (last 12 months) -----------------------------------------
    const now = dayjs();
    const months = Array.from({ length: 12 }, (_, i) => now.subtract(11 - i, 'month').startOf('month').toDate());

    const monthly = await Promise.all(
      months.map(async (m) => {
        const start = m;
        const end = dayjs(m).endOf('month').toDate();
        const [sumInv, cntOrders] = await Promise.all([
          prisma.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: start, lte: end }, status: { in: ['PAID', 'PENDING', 'OVERDUE'] } } }),
          prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
        ]);
        return { label: fmtMonth(m), total: Number(sumInv._sum.total ?? 0), orders: cntOrders };
      })
    );

    // --- Orders by status ---------------------------------------------------
    const statuses = ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const satisfies Readonly<OrderStatus[]>;
    const statusCounts: Record<(typeof statuses)[number], number> = {
      PENDING: 0,
      SCHEDULED: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    await Promise.all(
      (statuses as readonly OrderStatus[]).map(async (s) => {
        statusCounts[s] = await prisma.order.count({ where: { status: s } });
      })
    );
    const colorMap: Record<(typeof statuses)[number], string> = {
      PENDING: '#f59e0b',
      SCHEDULED: '#3b82f6',
      OUT_FOR_DELIVERY: '#06b6d4',
      DELIVERED: '#10b981',
      CANCELLED: '#ef4444',
    };
    const ordersByStatus = (statuses as readonly OrderStatus[])
      .filter((s) => (statusCounts[s] ?? 0) > 0)
      .map((s) => ({ status: s.toLowerCase(), count: statusCounts[s] || 0, color: colorMap[s] }));

    // --- Deliveries (daily, last 7 days) -----------------------------------
    const today = startOfDay(new Date());
    const from7 = addDays(today, -6);
    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: from7 } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const dailyMap = new Map<string, { day: string; delivered: number; pending: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dayjs(d).format('YYYY-MM-DD');
      dailyMap.set(key, { day: dayjs(d).format('ddd'), delivered: 0, pending: 0 });
    }
    for (const ro of recentOrders) {
      const key = dayjs(ro.createdAt).format('YYYY-MM-DD');
      const b = dailyMap.get(key);
      if (!b) continue;
      if (ro.status === 'DELIVERED') b.delivered += 1;
      else b.pending += 1;
    }
    const dailyDeliveries = Array.from(dailyMap.values());

    const pendingDeliveries = await prisma.order.count({ where: { status: { in: ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY'] } } });
    const deliveries = await prisma.order.count({ where: { status: 'DELIVERED' } });

    // --- Growth metrics -----------------------------------------------------
    const last7Start = dayjs(today).subtract(6, 'day').toDate();
    const prev7Start = dayjs(today).subtract(13, 'day').toDate();
    const prev7End = dayjs(today).subtract(7, 'day').toDate();

    const [revLast7Agg, revPrev7Agg] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: last7Start } } }),
      prisma.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: prev7Start, lt: prev7End } } }),
    ]);
    const revLast7 = Number(revLast7Agg._sum.total ?? 0);
    const revPrev7 = Number(revPrev7Agg._sum.total ?? 0);
    const weeklyGrowth = clampPercent(revPrev7 === 0 ? (revLast7 > 0 ? 100 : 0) : ((revLast7 - revPrev7) / revPrev7) * 100);

    const monthStart = dayjs(today).startOf('month').toDate();
    const prevMonthStart = dayjs(today).subtract(1, 'month').startOf('month').toDate();

    const [newCustThis, newCustPrev] = await Promise.all([
      prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.customer.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    ]);
    const customerGrowth = clampPercent(newCustPrev === 0 ? (newCustThis > 0 ? 100 : 0) : ((newCustThis - newCustPrev) / newCustPrev) * 100);

    const [ordersThis, ordersPrev] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    ]);
    const orderGrowth = clampPercent(ordersPrev === 0 ? (ordersThis > 0 ? 100 : 0) : ((ordersThis - ordersPrev) / ordersPrev) * 100);

    // --- Top products (last 30 days) ---------------------------------------
    const last30 = dayjs(today).subtract(29, 'day').toDate();
    type OrderItemWithProduct = { quantity: number; unitPrice: unknown; productId: string | null; product: { name: string } | null };
    const orderItemsRaw = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: last30 } } },
      select: { quantity: true, unitPrice: true, productId: true, product: { select: { name: true } } },
    }).catch(() => [] as OrderItemWithProduct[]);
    const orderItems = orderItemsRaw as OrderItemWithProduct[];

    const topMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const it of orderItems) {
      const key = (it.productId || it.product?.name || 'unknown') as string;
      const prev = topMap.get(key) || { name: it.product?.name || 'Unknown', quantity: 0, revenue: 0 };
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice as any || 0);
      prev.quantity += qty;
      prev.revenue += qty * price;
      topMap.set(key, prev);
    }
    const topProducts = Array.from(topMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // --- Low stock ----------------------------------------------------------
    const productsAll = await prisma.product.findMany({ select: { stock: true, lowStockLevel: true } });
    const lowStockItems = productsAll.filter((pp: typeof productsAll[number]) => (pp.lowStockLevel ?? 0) > 0 && (pp.stock ?? 0) <= (pp.lowStockLevel ?? 0)).length;

    // --- Recent activity ----------------------------------------------------
    const [recentOrders10, recentInvoices10] = await Promise.all([
      prisma.order.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, customer: { select: { name: true } } } }),
      prisma.invoice.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, invoiceNumber: true, total: true, createdAt: true, customer: { select: { name: true } } } }),
    ]);

    const recentActivity = [
      ...recentOrders10.map((o: typeof recentOrders10[number]) => ({
        id: `order-${o.id}`,
        type: 'order' as const,
        description: `Order for ${o.customer?.name ?? 'Customer'}`,
        time: dayjs(o.createdAt).format('YYYY-MM-DD HH:mm'),
        status: o.status === 'CANCELLED' ? ('error' as const) : o.status === 'DELIVERED' ? ('success' as const) : ('warning' as const),
      })),
      ...recentInvoices10.map((i: typeof recentInvoices10[number]) => ({
        id: `invoice-${i.id}`,
        type: 'invoice' as const,
        description: `Invoice #${i.invoiceNumber} - ${i.customer?.name ?? 'Customer'}`,
        time: dayjs(i.createdAt).format('YYYY-MM-DD HH:mm'),
        status: 'success' as const,
      })),
    ]
      .sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())
      .slice(0, 10);

    res.json({
      revenue,
      outstanding,
      customers,
      products,
      orders,
      deliveries,
      pendingDeliveries,
      lowStockItems,
      monthlyRevenue: monthly.reduce((s, m) => s + m.total, 0),
      weeklyGrowth,
      customerGrowth,
      orderGrowth,
      monthly,
      dailyDeliveries,
      topProducts,
      ordersByStatus,
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
