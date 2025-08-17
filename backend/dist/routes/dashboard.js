"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dayjs_1 = __importDefault(require("dayjs"));
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const fmtMonth = (d) => (0, dayjs_1.default)(d).format('MMM YY');
const startOfDay = (d = new Date()) => (0, dayjs_1.default)(d).startOf('day').toDate();
const addDays = (d, n) => (0, dayjs_1.default)(d).add(n, 'day').toDate();
const clampPercent = (n) => (Number.isFinite(n) ? Math.max(-999, Math.min(999, n)) : 0);
router.get('/metrics', async (_req, res, next) => {
    try {
        const [revenueAgg, outstandingAgg, customers, products, orders] = await Promise.all([
            prisma_1.prisma.invoice.aggregate({ _sum: { total: true }, where: { status: { in: ['PAID', 'PENDING', 'OVERDUE'] } } }),
            prisma_1.prisma.invoice.aggregate({ _sum: { balance: true }, where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
            prisma_1.prisma.customer.count(),
            prisma_1.prisma.product.count(),
            prisma_1.prisma.order.count(),
        ]);
        const revenue = Number(revenueAgg._sum.total ?? 0);
        const outstanding = Number(outstandingAgg._sum.balance ?? 0);
        const now = (0, dayjs_1.default)();
        const months = Array.from({ length: 12 }, (_, i) => now.subtract(11 - i, 'month').startOf('month').toDate());
        const monthly = await Promise.all(months.map(async (m) => {
            const start = m;
            const end = (0, dayjs_1.default)(m).endOf('month').toDate();
            const [sumInv, cntOrders] = await Promise.all([
                prisma_1.prisma.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: start, lte: end }, status: { in: ['PAID', 'PENDING', 'OVERDUE'] } } }),
                prisma_1.prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
            ]);
            return { label: fmtMonth(m), total: Number(sumInv._sum.total ?? 0), orders: cntOrders };
        }));
        const statuses = ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
        const statusCounts = {
            PENDING: 0,
            SCHEDULED: 0,
            OUT_FOR_DELIVERY: 0,
            DELIVERED: 0,
            CANCELLED: 0,
        };
        await Promise.all(statuses.map(async (s) => {
            statusCounts[s] = await prisma_1.prisma.order.count({ where: { status: s } });
        }));
        const colorMap = {
            PENDING: '#f59e0b',
            SCHEDULED: '#3b82f6',
            OUT_FOR_DELIVERY: '#06b6d4',
            DELIVERED: '#10b981',
            CANCELLED: '#ef4444',
        };
        const ordersByStatus = statuses
            .filter((s) => (statusCounts[s] ?? 0) > 0)
            .map((s) => ({ status: s.toLowerCase(), count: statusCounts[s] || 0, color: colorMap[s] }));
        const today = startOfDay(new Date());
        const from7 = addDays(today, -6);
        const recentOrders = await prisma_1.prisma.order.findMany({
            where: { createdAt: { gte: from7 } },
            select: { status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        const dailyMap = new Map();
        for (let i = 6; i >= 0; i--) {
            const d = addDays(today, -i);
            const key = (0, dayjs_1.default)(d).format('YYYY-MM-DD');
            dailyMap.set(key, { day: (0, dayjs_1.default)(d).format('ddd'), delivered: 0, pending: 0 });
        }
        for (const ro of recentOrders) {
            const key = (0, dayjs_1.default)(ro.createdAt).format('YYYY-MM-DD');
            const b = dailyMap.get(key);
            if (!b)
                continue;
            if (ro.status === 'DELIVERED')
                b.delivered += 1;
            else
                b.pending += 1;
        }
        const dailyDeliveries = Array.from(dailyMap.values());
        const pendingDeliveries = await prisma_1.prisma.order.count({ where: { status: { in: ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY'] } } });
        const deliveries = await prisma_1.prisma.order.count({ where: { status: 'DELIVERED' } });
        const last7Start = (0, dayjs_1.default)(today).subtract(6, 'day').toDate();
        const prev7Start = (0, dayjs_1.default)(today).subtract(13, 'day').toDate();
        const prev7End = (0, dayjs_1.default)(today).subtract(7, 'day').toDate();
        const [revLast7Agg, revPrev7Agg] = await Promise.all([
            prisma_1.prisma.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: last7Start } } }),
            prisma_1.prisma.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: prev7Start, lt: prev7End } } }),
        ]);
        const revLast7 = Number(revLast7Agg._sum.total ?? 0);
        const revPrev7 = Number(revPrev7Agg._sum.total ?? 0);
        const weeklyGrowth = clampPercent(revPrev7 === 0 ? (revLast7 > 0 ? 100 : 0) : ((revLast7 - revPrev7) / revPrev7) * 100);
        const monthStart = (0, dayjs_1.default)(today).startOf('month').toDate();
        const prevMonthStart = (0, dayjs_1.default)(today).subtract(1, 'month').startOf('month').toDate();
        const [newCustThis, newCustPrev] = await Promise.all([
            prisma_1.prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
            prisma_1.prisma.customer.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
        ]);
        const customerGrowth = clampPercent(newCustPrev === 0 ? (newCustThis > 0 ? 100 : 0) : ((newCustThis - newCustPrev) / newCustPrev) * 100);
        const [ordersThis, ordersPrev] = await Promise.all([
            prisma_1.prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
            prisma_1.prisma.order.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
        ]);
        const orderGrowth = clampPercent(ordersPrev === 0 ? (ordersThis > 0 ? 100 : 0) : ((ordersThis - ordersPrev) / ordersPrev) * 100);
        const last30 = (0, dayjs_1.default)(today).subtract(29, 'day').toDate();
        const orderItemsRaw = await prisma_1.prisma.orderItem.findMany({
            where: { order: { createdAt: { gte: last30 } } },
            select: { quantity: true, unitPrice: true, productId: true, product: { select: { name: true } } },
        }).catch(() => []);
        const orderItems = orderItemsRaw;
        const topMap = new Map();
        for (const it of orderItems) {
            const key = (it.productId || it.product?.name || 'unknown');
            const prev = topMap.get(key) || { name: it.product?.name || 'Unknown', quantity: 0, revenue: 0 };
            const qty = Number(it.quantity || 0);
            const price = Number(it.unitPrice || 0);
            prev.quantity += qty;
            prev.revenue += qty * price;
            topMap.set(key, prev);
        }
        const topProducts = Array.from(topMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const productsAll = await prisma_1.prisma.product.findMany({ select: { stock: true, lowStockLevel: true } });
        const lowStockItems = productsAll.filter((pp) => (pp.lowStockLevel ?? 0) > 0 && (pp.stock ?? 0) <= (pp.lowStockLevel ?? 0)).length;
        const [recentOrders10, recentInvoices10] = await Promise.all([
            prisma_1.prisma.order.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, customer: { select: { name: true } } } }),
            prisma_1.prisma.invoice.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, invoiceNumber: true, total: true, createdAt: true, customer: { select: { name: true } } } }),
        ]);
        const recentActivity = [
            ...recentOrders10.map((o) => ({
                id: `order-${o.id}`,
                type: 'order',
                description: `Order for ${o.customer?.name ?? 'Customer'}`,
                time: (0, dayjs_1.default)(o.createdAt).format('YYYY-MM-DD HH:mm'),
                status: o.status === 'CANCELLED' ? 'error' : o.status === 'DELIVERED' ? 'success' : 'warning',
            })),
            ...recentInvoices10.map((i) => ({
                id: `invoice-${i.id}`,
                type: 'invoice',
                description: `Invoice #${i.invoiceNumber} - ${i.customer?.name ?? 'Customer'}`,
                time: (0, dayjs_1.default)(i.createdAt).format('YYYY-MM-DD HH:mm'),
                status: 'success',
            })),
        ]
            .sort((a, b) => (0, dayjs_1.default)(b.time).valueOf() - (0, dayjs_1.default)(a.time).valueOf())
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
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map