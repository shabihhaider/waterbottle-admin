"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Filter,
  Calendar as CalendarIcon,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  DollarSign,
  Activity,
  Target,
  Layers,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Info,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

/********************* Types *********************/
interface TimePoint { label: string; revenue: number; orders: number; aov: number; customers: number }
interface TopProduct { name: string; quantity: number; revenue: number }
interface TopCustomer { name: string; orders: number; revenue: number }
interface ChannelPart { channel: string; orders: number; revenue: number }
interface StatusPart { status: string; count: number }

interface AnalyticsPayload {
  range: { start: string; end: string };
  kpis: {
    revenue: number;
    orders: number;
    customers: number;
    aov: number; // average order value
    growthRevenuePct: number; // vs prev period
    growthOrdersPct: number;
    churnPct: number;
    conversionPct: number;
  };
  timeseries: TimePoint[]; // preferably sorted
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  channels: ChannelPart[];
  ordersByStatus: StatusPart[];
}

/********************* Helpers *********************/
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];
const toStr = (v: unknown, fb = ""): string => (v === undefined || v === null ? fb : String(v));
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/********************* Page *********************/
export default function AnalyticsPage() {
  // Data
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI & filters
  const [refreshing, setRefreshing] = useState(false);
  const [rangePreset, setRangePreset] = useState("last_30");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showFilter, setShowFilter] = useState(false);

  const load = async (opts?: { start?: string; end?: string; preset?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const body: any = {};
      if (opts?.start && opts?.end) {
        body.start = opts.start;
        body.end = opts.end;
      } else {
        body.preset = opts?.preset ?? rangePreset;
      }
      const res = await api<AnalyticsPayload>("/analytics", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ preset: rangePreset });
    const id = setInterval(() => load({ preset: rangePreset }), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  const handleRefresh = async () => {
    setRefreshing(true);
    await load({ preset: rangePreset });
    setTimeout(() => setRefreshing(false), 800);
  };

  const applyCustomRange = () => {
    if (!startDate || !endDate) return;
    setRangePreset("custom");
    setShowFilter(false);
    load({ start: startDate, end: endDate });
  };

  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = [];
    rows.push(["Label", "Revenue", "Orders", "AOV", "Customers"].join(","));
    for (const p of data.timeseries) rows.push([p.label, String(p.revenue), String(p.orders), String(p.aov), String(p.customers)].join(","));
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${data.range.start}_${data.range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /********************* Derived *********************/
  const totals = useMemo(() => {
    if (!data) return null;
    const last = data.timeseries.at(-1);
    const first = data.timeseries[0];
    return { last, first };
  }, [data]);

  if (loading) return <AnalyticsSkeleton />;
  if (error)
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 text-center">
        <p className="text-lg font-semibold mb-2">Unable to load analytics</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={() => load({ preset: rangePreset })} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Try Again</button>
      </motion.div>
    );

  if (!data) return null;

  const KPI = [
    {
      title: "Revenue",
      value: formatPKR(num(data.kpis.revenue)),
      change: num(data.kpis.growthRevenuePct),
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Orders",
      value: (num(data.kpis.orders) || 0).toLocaleString(),
      change: num(data.kpis.growthOrdersPct),
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Customers",
      value: (num(data.kpis.customers) || 0).toLocaleString(),
      change: 0,
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
    },
    {
      title: "Avg. Order Value",
      value: formatPKR(num(data.kpis.aov)),
      change: 0,
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Conversion",
      value: `${num(data.kpis.conversionPct).toFixed(1)}%`,
      change: 0,
      icon: Target,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Churn",
      value: `${num(data.kpis.churnPct).toFixed(1)}%`,
      change: 0,
      icon: Layers,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950",
    },
  ];

  return (
    <div className="space-y-6 fade-in max-w-8xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Analytics</h1>
          <p className="text-muted-foreground">Deep-dive into revenue, orders, customers, and product performance</p>
          <p className="text-xs text-muted-foreground mt-1">Range: {data.range.start} → {data.range.end}</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <RefreshCw className={clsx("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
          <motion.button onClick={() => setShowFilter(true)} className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Filter className="h-4 w-4" /> Filters
          </motion.button>
          <motion.button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Download className="h-4 w-4" /> Export CSV
          </motion.button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {KPI.map((k, i) => (
          <KpiCard key={k.title} k={k} index={i} />
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        {/* Revenue & Orders */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="2xl:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Revenue & Orders</h3>
              <p className="text-muted-foreground text-sm">Trend over time</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary rounded-full" />Revenue</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full" />Orders</div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeseries}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" />
                <Area yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#ordGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Orders by Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Orders by Status</h3>
              <p className="text-muted-foreground text-sm">Distribution</p>
            </div>
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.ordersByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="count" paddingAngle={2}>
                  {data.ordersByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* AOV line */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Average Order Value</h3>
              <p className="text-muted-foreground text-sm">Rs/order</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="aov" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Channels */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Channel Mix</h3>
              <p className="text-muted-foreground text-sm">Orders by channel</p>
            </div>
            <Target className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.channels}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="orders" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Products */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Top Products</h3>
              <p className="text-muted-foreground text-sm">By revenue</p>
            </div>
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {(data.topProducts ?? []).slice(0, 8).map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg" style={{ background: COLORS[i % COLORS.length] + "20" }} />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{p.quantity} units</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatPKR(num(p.revenue))}</div>
                  <div className="text-sm text-muted-foreground">Revenue</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Customers & Notes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Top Customers</h3>
              <p className="text-muted-foreground text-sm">Most valuable in this range</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Orders</th>
                  <th className="text-left p-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data.topCustomers ?? []).slice(0, 10).map((c, i) => (
                  <tr key={c.name} className="border-b border-border">
                    <td className="p-3">{c.name}</td>
                    <td className="p-3">{num(c.orders).toLocaleString()}</td>
                    <td className="p-3 font-medium">{formatPKR(num(c.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Insights</h3>
              <p className="text-muted-foreground text-sm">Auto-generated highlights</p>
            </div>
            <Info className="h-5 w-5 text-muted-foreground" />
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600 mt-0.5" />
              <span>
                Revenue growth this period: <strong>{num(data.kpis.growthRevenuePct).toFixed(1)}%</strong> vs previous.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600 mt-0.5" />
              <span>
                Churn at <strong>{num(data.kpis.churnPct).toFixed(1)}%</strong>. Consider win-back offers for at-risk customers.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
              <span>
                Best-selling product: <strong>{toStr(data.topProducts?.[0]?.name, "—")}</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5" />
              <span>
                Channel leading orders: <strong>{toStr(data.channels?.[0]?.channel, "—")}</strong>.
              </span>
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Filters Modal */}
      <AnimatePresence>
        {showFilter && (
          <FilterModal
            preset={rangePreset}
            setPreset={setRangePreset}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            onApply={applyCustomRange}
            onClose={() => setShowFilter(false)}
            onQuickApply={() => {
              setShowFilter(false);
              load({ preset: rangePreset });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/********************* Components *********************/
function KpiCard({ k, index }: { k: any; index: number }) {
  const Icon = k.icon;
  const change = Number(k.change || 0);
  const pos = change > 0;
  const neg = change < 0;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} whileHover={{ y: -4 }} className={clsx("card p-6 relative overflow-hidden")}>      
      <div className="absolute inset-0 opacity-5"><div className={clsx("w-full h-full", k.bg)} /></div>
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{k.title}</p>
          <p className="text-2xl font-bold mb-2">{k.value}</p>
          {k.change !== 0 && (
            <div className="flex items-center gap-1 text-sm">
              {pos ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
              <span className={clsx("font-medium", pos && "text-green-600", neg && "text-red-600")}>{Math.abs(change).toFixed(1)}%</span>
              <span className="text-muted-foreground">vs previous</span>
            </div>
          )}
        </div>
        <div className={clsx("p-3 rounded-xl", k.bg)}>
          <Icon className={clsx("h-6 w-6", k.color)} />
        </div>
      </div>
    </motion.div>
  );
}

function FilterModal({ preset, setPreset, startDate, setStartDate, endDate, setEndDate, onApply, onClose, onQuickApply }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-xl card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Filters</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Quick range</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="last_7">Last 7 days</option>
              <option value="last_30">Last 30 days</option>
              <option value="last_90">Last 90 days</option>
              <option value="ytd">Year to date</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={onQuickApply} className="flex-1 px-3 py-2 bg-secondary rounded-lg hover:bg-secondary/80">Apply preset</button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onApply} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Apply custom range</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/********************* Skeleton *********************/
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 w-48 bg-muted rounded" />
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

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <div className="2xl:col-span-2 card p-6 h-96" />
        <div className="card p-6 h-96" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 h-80" />
        <div className="card p-6 h-80" />
        <div className="card p-6 h-80" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6 h-80" />
        <div className="card p-6 h-80" />
      </div>
    </div>
  );
}
