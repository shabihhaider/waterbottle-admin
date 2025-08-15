'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPKR } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Package, Truck, 
  AlertTriangle, Clock, CheckCircle, Calendar, Droplets, Target,
  ArrowUpRight, ArrowDownRight, Eye, RefreshCw
} from 'lucide-react';
import clsx from 'clsx';

type Metrics = {
  revenue: number;
  outstanding: number;
  customers: number;
  products: number;
  orders: number;
  deliveries: number;
  pendingDeliveries: number;
  lowStockItems: number;
  monthlyRevenue: number;
  weeklyGrowth: number;
  customerGrowth: number;
  orderGrowth: number;
  monthly: { label: string; total: number; orders: number }[];
  dailyDeliveries: { day: string; delivered: number; pending: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  ordersByStatus: { status: string; count: number; color?: string }[];
  recentActivity: { id: string; type: string; description: string; time: string; status: 'success' | 'warning' | 'error' }[];
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

/** ---------- Safe helpers ---------- */
const toStr = (v: unknown, fallback = 'N/A') =>
  v === null || v === undefined ? fallback : String(v);

const fmtInt = (v: unknown, fallback = '0') =>
  Number.isFinite(Number(v)) ? Number(v).toLocaleString() : fallback;

const numOr0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const sanitizeMetrics = (raw: Partial<Metrics> | null | undefined): Metrics => ({
  revenue: numOr0(raw?.revenue),
  outstanding: numOr0(raw?.outstanding),
  customers: numOr0(raw?.customers),
  products: numOr0(raw?.products),
  orders: numOr0(raw?.orders),
  deliveries: numOr0(raw?.deliveries),
  pendingDeliveries: numOr0(raw?.pendingDeliveries),
  lowStockItems: numOr0(raw?.lowStockItems),
  monthlyRevenue: numOr0(raw?.monthlyRevenue),
  weeklyGrowth: Number.isFinite(Number(raw?.weeklyGrowth)) ? Number(raw!.weeklyGrowth) : 0,
  customerGrowth: Number.isFinite(Number(raw?.customerGrowth)) ? Number(raw!.customerGrowth) : 0,
  orderGrowth: Number.isFinite(Number(raw?.orderGrowth)) ? Number(raw!.orderGrowth) : 0,
  monthly: Array.isArray(raw?.monthly) ? raw!.monthly : [],
  dailyDeliveries: Array.isArray(raw?.dailyDeliveries) ? raw!.dailyDeliveries : [],
  topProducts: Array.isArray(raw?.topProducts) ? raw!.topProducts : [],
  ordersByStatus: Array.isArray(raw?.ordersByStatus) ? raw!.ordersByStatus : [],
  recentActivity: Array.isArray(raw?.recentActivity) ? raw!.recentActivity : [],
});

export default function Dashboard() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api<Metrics>('/dashboard/metrics');
      setData(sanitizeMetrics(res as any));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (loading) return <SkeletonDashboard />;
  if (error) return <ErrorState error={error} onRetry={loadData} />;
  if (!data) return null;

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatPKR(data.revenue),
      change: data.weeklyGrowth ?? 0,
      changeLabel: 'vs last week',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      trend: (data.monthly ?? []).slice(-7)
    },
    {
      title: 'Outstanding Payments',
      value: formatPKR(data.outstanding),
      change: -5.2,
      changeLabel: 'vs last week',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
      alert: data.outstanding > 50000
    },
    {
      title: 'Active Customers',
      value: fmtInt(data.customers, '0'),
      change: data.customerGrowth ?? 0,
      changeLabel: 'new this month',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950'
    },
    {
      title: 'Pending Deliveries',
      value: fmtInt(data.pendingDeliveries, '0'),
      change: -12,
      changeLabel: 'vs yesterday',
      icon: Truck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      urgent: data.pendingDeliveries > 10
    },
    {
      title: 'Total Orders',
      value: fmtInt(data.orders, '0'),
      change: data.orderGrowth ?? 0,
      changeLabel: 'this month',
      icon: Package,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950'
    },
    {
      title: 'Low Stock Items',
      value: fmtInt(data.lowStockItems, '0'),
      change: 0,
      changeLabel: 'items need restock',
      icon: Droplets,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
      critical: data.lowStockItems > 5
    }
  ];

  return (
    <div className="space-y-8 fade-in max-w-8xl">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Water delivery business overview</p>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
          
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <StatCard key={stat.title} stat={stat} index={index} />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Revenue & Orders Trend</h3>
              <p className="text-muted-foreground text-sm">Last 12 months performance</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Orders</span>
              </div>
            </div>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(data.monthly ?? []).map(d => ({
                label: toStr(d?.label, ''),
                total: numOr0(d?.total),
                orders: numOr0(d?.orders)
              }))}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#ordersGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Order Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-lg mb-6">Order Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data.ordersByStatus ?? []).map((s) => ({
                    ...s,
                    status: toStr(s?.status, 'unknown'),
                    count: numOr0(s?.count),
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {(data.ordersByStatus ?? []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {(data.ordersByStatus ?? []).map((status, index) => (
              <div key={`${status.status}-${index}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="capitalize">{toStr(status.status, 'unknown')}</span>
                </div>
                <span className="font-medium">{fmtInt(status.count, '0')}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-lg mb-6">Top Selling Products</h3>
          <div className="space-y-4">
            {(data.topProducts ?? []).map((product, index) => (
              <motion.div
                key={`${product.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-accent/20 rounded-lg hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Droplets className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{toStr(product.name, 'Unnamed')}</div>
                    <div className="text-sm text-muted-foreground">{fmtInt(product.quantity, '0')} units sold</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatPKR(numOr0(product.revenue))}</div>
                  <div className="text-sm text-muted-foreground">Revenue</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg">Recent Activity</h3>
            <button className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1">
              <Eye className="h-4 w-4" />
              View All
            </button>
          </div>
          
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {(data.recentActivity ?? []).map((activity, index) => (
              <motion.div
                key={activity.id ?? `activity-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/20 transition-colors"
              >
                <div className={clsx(
                  'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                  activity.status === 'success' && 'bg-green-500',
                  activity.status === 'warning' && 'bg-orange-500',
                  activity.status === 'error' && 'bg-red-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{toStr(activity.description, 'Activity')}</p>
                  <p className="text-xs text-muted-foreground">{toStr(activity.time, '')}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Daily Deliveries Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-lg mb-6">Daily Deliveries Status</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(data.dailyDeliveries ?? []).map(d => ({
              day: toStr(d?.day, ''),
              delivered: numOr0(d?.delivered),
              pending: numOr0(d?.pending),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ stat, index }: { stat: any; index: number }) {
  const Icon = stat.icon;
  const change = Number.isFinite(Number(stat.change)) ? Number(stat.change) : 0;
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={clsx(
        'card p-6 card-hover relative overflow-hidden',
        stat.alert && 'ring-2 ring-orange-200 dark:ring-orange-800',
        stat.urgent && 'ring-2 ring-red-200 dark:ring-red-800',
        stat.critical && 'ring-2 ring-red-300 dark:ring-red-700'
      )}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className={clsx('w-full h-full', stat.bgColor)} />
      </div>

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-2xl font-bold mb-2">{toStr(stat.value, 'N/A')}</p>
            
            {change !== 0 && (
              <div className="flex items-center gap-1 text-sm">
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span className={clsx(
                  'font-medium',
                  isPositive && 'text-green-600',
                  isNegative && 'text-red-600'
                )}>
                  {Math.abs(change)}%
                </span>
                <span className="text-muted-foreground">{stat.changeLabel}</span>
              </div>
            )}
          </div>
          
          <div className={clsx('p-3 rounded-xl', stat.bgColor)}>
            <Icon className={clsx('h-6 w-6', stat.color)} />
          </div>
        </div>

        {/* Alert Indicators */}
        {(stat.alert || stat.urgent || stat.critical) && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2"
          >
            <div className={clsx(
              'w-3 h-3 rounded-full',
              stat.critical && 'bg-red-500 animate-pulse',
              stat.urgent && 'bg-orange-500',
              stat.alert && 'bg-yellow-500'
            )} />
          </motion.div>
        )}

        {/* Mini trend chart for revenue */}
        {Array.isArray(stat.trend) && stat.trend.length > 0 && (
          <div className="mt-4 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stat.trend.map((t: any) => ({ total: numOr0(t?.total) }))}>
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke={isPositive ? '#10b981' : '#ef4444'} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 w-32 bg-muted rounded" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-8 w-32 bg-muted rounded" />
                <div className="h-4 w-28 bg-muted rounded" />
              </div>
              <div className="w-12 h-12 bg-muted rounded-xl" />
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 h-96" />
        <div className="card p-6 h-96" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card p-8 text-center"
    >
      <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Unable to load dashboard</h3>
      <p className="text-muted-foreground mb-6">{error}</p>
      <motion.button
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Try Again
      </motion.button>
    </motion.div>
  );
}
