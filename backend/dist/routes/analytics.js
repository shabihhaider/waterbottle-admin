"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
function resolveRange(input) {
    const now = (0, dayjs_1.default)();
    let start;
    let end;
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
            const e = input.to ? (0, dayjs_1.default)(input.to) : now;
            const s = input.from ? (0, dayjs_1.default)(input.from) : e.subtract(30, 'day');
            start = s;
            end = e;
        }
    }
    return { start: start.startOf('day'), end: end.endOf('day') };
}
function rangeDays(start, end) {
    const out = [];
    let cur = start.startOf('day');
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
        out.push(cur);
        cur = cur.add(1, 'day');
    }
    return out;
}
const INVOICE_STATUSES_FOR_REVENUE = ['PAID', 'PENDING', 'OVERDUE'];
async function buildAnalytics(start, end) {
    const startJS = start.toDate();
    const endJS = end.toDate();
    const [orders, invoices, items] = await Promise.all([
        prisma_1.prisma.order.findMany({
            where: { createdAt: { gte: startJS, lte: endJS } },
            select: { id: true, createdAt: true, status: true, customerId: true, routeCode: true, orderNumber: true },
            orderBy: { createdAt: 'asc' },
        }),
        prisma_1.prisma.invoice.findMany({
            where: {
                createdAt: { gte: startJS, lte: endJS },
                status: { in: INVOICE_STATUSES_FOR_REVENUE },
            },
            select: { id: true, createdAt: true, total: true, customerId: true, orderId: true, status: true },
        }),
        prisma_1.prisma.orderItem.findMany({
            where: { order: { createdAt: { gte: startJS, lte: endJS } } },
            select: { quantity: true, unitPrice: true, productId: true, orderId: true },
        }),
    ]);
    const productMap = new Map();
    const productIds = Array.from(new Set(items.map(i => i.productId)));
    if (productIds.length) {
        const prods = await prisma_1.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, sku: true },
        });
        prods.forEach(p => productMap.set(p.id, { name: p.name, sku: p.sku ?? null }));
    }
    const customerMap = new Map();
    const customerIds = Array.from(new Set(orders.map(o => o.customerId)));
    if (customerIds.length) {
        const cs = await prisma_1.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
        });
        cs.forEach(c => customerMap.set(c.id, { name: c.name }));
    }
    const ordersCount = orders.length;
    const revenueSum = invoices.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const uniqueCustomers = new Set(orders.map(o => o.customerId)).size;
    const aov = ordersCount ? revenueSum / ordersCount : 0;
    const daysInRange = end.startOf('day').diff(start.startOf('day'), 'day') + 1;
    const prevStart = start.subtract(daysInRange, 'day');
    const prevEnd = start.subtract(1, 'day');
    const [prevRevenueRow, prevOrdersCount] = await Promise.all([
        prisma_1.prisma.invoice.aggregate({
            _sum: { total: true },
            where: {
                createdAt: { gte: prevStart.startOf('day').toDate(), lte: prevEnd.endOf('day').toDate() },
                status: { in: INVOICE_STATUSES_FOR_REVENUE },
            },
        }),
        prisma_1.prisma.order.count({ where: { createdAt: { gte: prevStart.startOf('day').toDate(), lte: prevEnd.endOf('day').toDate() } } }),
    ]);
    const prevRevenue = Number(prevRevenueRow._sum.total ?? 0);
    const growthRevenuePct = prevRevenue > 0 ? ((revenueSum - prevRevenue) / prevRevenue) * 100 : 0;
    const growthOrdersPct = prevOrdersCount > 0 ? ((ordersCount - prevOrdersCount) / prevOrdersCount) * 100 : 0;
    const days = rangeDays(start, end);
    const revenueByDay = {};
    const ordersByDay = {};
    const customersByDay = {};
    for (const d of days) {
        const key = d.format('YYYY-MM-DD');
        revenueByDay[key] = 0;
        ordersByDay[key] = 0;
        customersByDay[key] = new Set();
    }
    for (const inv of invoices) {
        const key = (0, dayjs_1.default)(inv.createdAt).format('YYYY-MM-DD');
        if (revenueByDay[key] !== undefined)
            revenueByDay[key] += Number(inv.total ?? 0);
    }
    for (const o of orders) {
        const key = (0, dayjs_1.default)(o.createdAt).format('YYYY-MM-DD');
        if (ordersByDay[key] !== undefined) {
            ordersByDay[key] += 1;
            if (o.customerId)
                customersByDay[key].add(o.customerId);
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
    const prodAgg = new Map();
    for (const it of items) {
        const qty = Number(it.quantity || 0);
        const rev = Number(it.unitPrice || 0) * qty;
        const prodInfo = productMap.get(it.productId);
        if (!prodInfo)
            continue;
        const key = it.productId;
        if (!prodAgg.has(key))
            prodAgg.set(key, { quantity: 0, revenue: 0, name: prodInfo.name });
        const entry = prodAgg.get(key);
        entry.quantity += qty;
        entry.revenue += rev;
    }
    const topProducts = Array.from(prodAgg.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(p => ({ name: p.name, quantity: p.quantity, revenue: p.revenue }));
    const invByCustomer = {};
    for (const inv of invoices) {
        const cid = inv.customerId;
        if (!cid)
            continue;
        invByCustomer[cid] = (invByCustomer[cid] || 0) + Number(inv.total ?? 0);
    }
    const ordersByCustomer = {};
    for (const o of orders) {
        const cid = o.customerId;
        if (!cid)
            continue;
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
    const channelAgg = new Map();
    const revenueByOrderId = new Map();
    for (const inv of invoices) {
        if (inv.orderId)
            revenueByOrderId.set(inv.orderId, (revenueByOrderId.get(inv.orderId) || 0) + Number(inv.total ?? 0));
    }
    for (const o of orders) {
        const ch = (o.routeCode?.trim() || 'Unassigned');
        if (!channelAgg.has(ch))
            channelAgg.set(ch, { orders: 0, revenue: 0 });
        const entry = channelAgg.get(ch);
        entry.orders += 1;
        entry.revenue += revenueByOrderId.get(o.id) || 0;
    }
    const channels = Array.from(channelAgg.entries())
        .map(([channel, v]) => ({ channel, orders: v.orders, revenue: v.revenue }))
        .sort((a, b) => b.orders - a.orders);
    const statusAgg = new Map();
    for (const o of orders) {
        statusAgg.set(o.status, (statusAgg.get(o.status) || 0) + 1);
    }
    const ordersByStatus = Array.from(statusAgg.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
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
router.get('/', async (req, res, next) => {
    try {
        const { start, end } = resolveRange({ from: req.query.from, to: req.query.to, preset: req.query.preset || undefined });
        const payload = await buildAnalytics(start, end);
        res.json(payload);
    }
    catch (err) {
        console.error('GET /analytics error:', err);
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { start, end } = resolveRange({ from: req.body?.start, to: req.body?.end, preset: req.body?.preset });
        const payload = await buildAnalytics(start, end);
        res.json(payload);
    }
    catch (err) {
        console.error('POST /analytics error:', err);
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map