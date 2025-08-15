// backend/src/routes/analytics.ts
import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

type NumDict = Record<string, number>;

type RangeInput = {
  from?: string;
  to?: string;
  preset?: 'last_7' | 'last_30' | 'last_90' | 'ytd' | 'custom' | string;
};

function resolveRange(input: RangeInput) {
  const now = dayjs();
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  switch (input.preset) {
    case 'last_7':
      end = now;
      start = end.subtract(6, 'day');
      break;
    case 'last_30':
      end = now;
      start = end.subtract(29, 'day');
      break;
    case 'last_90':
      end = now;
      start = end.subtract(89, 'day');
      break;
    case 'ytd':
      start = now.startOf('year');
      end = now;
      break;
    default: {
      const e = input.to ? dayjs(input.to) : now;
      const s = input.from ? dayjs(input.from) : e.subtract(30, 'day');
      start = s;
      end = e;
    }
  }

  return { start: start.startOf('day'), end: end.endOf('day') };
}

function rangeDays(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const out: dayjs.Dayjs[] = [];
  let cur = start.startOf('day');
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    out.push(cur);
    cur = cur.add(1, 'day');
  }
  return out;
}

const INVOICE_STATUSES_FOR_REVENUE = ['PAID', 'PENDING', 'OVERDUE'] as const;

async function buildAnalytics(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const startJS = start.toDate();
  const endJS = end.toDate();

  // ---- Pull raw data within range ----------------------------------------
  const [orders, invoices, items] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: startJS, lte: endJS } },
      select: { id: true, createdAt: true, status: true, customerId: true, routeCode: true, orderNumber: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invoice.findMany({
      where: {
        createdAt: { gte: startJS, lte: endJS },
        status: { in: INVOICE_STATUSES_FOR_REVENUE as any },
      },
      select: { id: true, createdAt: true, total: true, customerId: true, orderId: true, status: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: startJS, lte: endJS } } },
      select: { quantity: true, unitPrice: true, productId: true, orderId: true },
    }),
  ]);

  // Map for joins: products
  const productMap = new Map<string, { name: string; sku: string | null }>();
  const productIds = Array.from(new Set(items.map(i => i.productId)));
  if (productIds.length) {
    const prods = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    prods.forEach(p => productMap.set(p.id, { name: p.name, sku: p.sku ?? null }));
  }

  // Map for joins: customers
  const customerMap = new Map<string, { name: string }>();
  const customerIds = Array.from(new Set(orders.map(o => o.customerId)));
  if (customerIds.length) {
    const cs = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    cs.forEach(c => customerMap.set(c.id, { name: c.name }));
  }

  // ---- KPI aggregates (period) -------------------------------------------
  const ordersCount = orders.length;
  const revenueSum = invoices.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const uniqueCustomers = new Set(orders.map(o => o.customerId)).size;
  const aov = ordersCount ? revenueSum / ordersCount : 0;

  // growth vs previous equal window (revenue & orders)
  const daysInRange = end.startOf('day').diff(start.startOf('day'), 'day') + 1;
  const prevStart = start.subtract(daysInRange, 'day');
  const prevEnd = start.subtract(1, 'day');

  const [prevRevenueRow, prevOrdersCount] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        createdAt: { gte: prevStart.startOf('day').toDate(), lte: prevEnd.endOf('day').toDate() },
        status: { in: INVOICE_STATUSES_FOR_REVENUE as any },
      },
    }),
    prisma.order.count({ where: { createdAt: { gte: prevStart.startOf('day').toDate(), lte: prevEnd.endOf('day').toDate() } } }),
  ]);
  const prevRevenue = Number(prevRevenueRow._sum.total ?? 0);
  const growthRevenuePct = prevRevenue > 0 ? ((revenueSum - prevRevenue) / prevRevenue) * 100 : 0;
  const growthOrdersPct = prevOrdersCount > 0 ? ((ordersCount - prevOrdersCount) / prevOrdersCount) * 100 : 0;

  // ---- Timeseries (per day) ----------------------------------------------
  const days = rangeDays(start, end);
  const revenueByDay: NumDict = {};
  const ordersByDay: NumDict = {};
  const customersByDay: Record<string, Set<string>> = {};

  for (const d of days) {
    const key = d.format('YYYY-MM-DD');
    revenueByDay[key] = 0;
    ordersByDay[key] = 0;
    customersByDay[key] = new Set<string>();
  }
  for (const inv of invoices) {
    const key = dayjs(inv.createdAt).format('YYYY-MM-DD');
    if (revenueByDay[key] !== undefined) revenueByDay[key] += Number(inv.total ?? 0);
  }
  for (const o of orders) {
    const key = dayjs(o.createdAt).format('YYYY-MM-DD');
    if (ordersByDay[key] !== undefined) {
      ordersByDay[key] += 1;
      if (o.customerId) customersByDay[key].add(o.customerId);
    }
  }

  const timeseries = days.map(d => {
    const key = d.format('YYYY-MM-DD');
    const orders = ordersByDay[key] || 0;
    const revenue = revenueByDay[key] || 0;
    const customers = customersByDay[key]?.size || 0;
    const aov = orders ? revenue / orders : 0;
    return { label: d.format('MMM D'), revenue, orders, aov, customers };
  });

  // ---- Top products (by quantity & revenue) ------------------------------
  const prodAgg = new Map<string, { quantity: number; revenue: number; name: string }>();
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    const rev = Number(it.unitPrice || 0) * qty;
    const prodInfo = productMap.get(it.productId);
    if (!prodInfo) continue;
    const key = it.productId;
    if (!prodAgg.has(key)) prodAgg.set(key, { quantity: 0, revenue: 0, name: prodInfo.name });
    const entry = prodAgg.get(key)!;
    entry.quantity += qty;
    entry.revenue += rev;
  }
  const topProducts = Array.from(prodAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(p => ({ name: p.name, quantity: p.quantity, revenue: p.revenue }));

  // ---- Top customers (by revenue, with order count) ----------------------
  const invByCustomer: Record<string, number> = {};
  for (const inv of invoices) {
    const cid = inv.customerId;
    if (!cid) continue;
    invByCustomer[cid] = (invByCustomer[cid] || 0) + Number(inv.total ?? 0);
  }
  const ordersByCustomer: Record<string, number> = {};
  for (const o of orders) {
    const cid = o.customerId;
    if (!cid) continue;
    ordersByCustomer[cid] = (ordersByCustomer[cid] || 0) + 1;
  }
  const topCustomers = Object.keys(invByCustomer)
    .map(cid => ({
      name: customerMap.get(cid)?.name ?? 'Customer',
      orders: ordersByCustomer[cid] || 0,
      revenue: invByCustomer[cid] || 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ---- Channels (group by Order.routeCode) -------------------------------
  const channelAgg = new Map<string, { orders: number; revenue: number }>();
  const revenueByOrderId = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.orderId) revenueByOrderId.set(inv.orderId, (revenueByOrderId.get(inv.orderId) || 0) + Number(inv.total ?? 0));
  }
  for (const o of orders) {
    const ch = (o.routeCode?.trim() || 'Unassigned');
    if (!channelAgg.has(ch)) channelAgg.set(ch, { orders: 0, revenue: 0 });
    const entry = channelAgg.get(ch)!;
    entry.orders += 1;
    entry.revenue += revenueByOrderId.get(o.id) || 0;
  }
  const channels = Array.from(channelAgg.entries())
    .map(([channel, v]) => ({ channel, orders: v.orders, revenue: v.revenue }))
    .sort((a, b) => b.orders - a.orders);

  // ---- Orders by status (bar/pie shape) ----------------------------------
  const statusAgg = new Map<string, number>();
  for (const o of orders) {
    statusAgg.set(o.status, (statusAgg.get(o.status) || 0) + 1);
  }
  const ordersByStatus = Array.from(statusAgg.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // ---- Shape response -----------------------------------------------------
  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    kpis: {
      revenue: revenueSum,
      orders: ordersCount,
      customers: uniqueCustomers,
      aov,
      growthRevenuePct,
      growthOrdersPct,
      churnPct: 0,
      conversionPct: 0,
    },
    timeseries,
    topProducts,
    topCustomers,
    channels,
    ordersByStatus,
  };
}

// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { start, end } = resolveRange({ from: req.query.from as string, to: req.query.to as string, preset: (req.query.preset as string) || undefined });
    const payload = await buildAnalytics(start, end);
    res.json(payload);
  } catch (err) {
    console.error('GET /analytics error:', err);
    next(err);
  }
});

// POST /api/analytics  { preset?: 'last_30' | ...; start?: string; end?: string }
router.post('/', async (req, res, next) => {
  try {
    const { start, end } = resolveRange({ from: req.body?.start, to: req.body?.end, preset: req.body?.preset });
    const payload = await buildAnalytics(start, end);
    res.json(payload);
  } catch (err) {
    console.error('POST /analytics error:', err);
    next(err);
  }
});

export default router;
