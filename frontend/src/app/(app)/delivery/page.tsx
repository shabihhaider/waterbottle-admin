"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Plus,
  Search,
  MapPin,
  Truck,
  UserCircle2,
  CheckCircle2,
  XCircle,
  Clock,
  PackageCheck,
  SortAsc,
  SortDesc,
  X,
} from "lucide-react";
import clsx from "clsx";

/********************* Types *********************/
export type DeliveryStatus = "scheduled" | "out_for_delivery" | "delivered" | "failed";
interface Driver { id: string; name: string; phone?: string }
interface OrderLite { id: string; orderNumber: number; customer?: { id: string; name: string; address?: string } }
interface Delivery {
  id: string;
  deliveryNumber: number;
  status: DeliveryStatus;
  orderId: string;
  order?: OrderLite;
  driverId?: string | null;
  driver?: Driver | null;
  scheduledDate?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  address?: string | null;
  createdAt?: string;
}

/********************* Helpers (module-scope, no duplicates) *********************/
const toStr = (v: unknown, fb = ""): string => (v === undefined || v === null ? fb : String(v));
const dateLabel = (iso?: string | null, fb = "-") => (iso ? new Date(iso).toLocaleString() : fb);

/********************* Page *********************/
export default function DeliveryPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // filters/sort
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DeliveryStatus>("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // row-level saving indicator
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});

  // create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ orderId: "", driverId: "", scheduledDate: "", notes: "" });

  // map of driver id to driver for O(1) lookups
  const driverById = useMemo(() => {
    const map: Record<string, Driver> = {};
    for (const d of drivers) map[d.id] = d;
    return map;
  }, [drivers]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [d, dr, o] = await Promise.all([
        api<Delivery[]>("/deliveries"),
        api<Driver[]>("/drivers"),
        api<OrderLite[]>("/orders?status=pending"),
      ]);
      // sort drivers for nicer UX
      const sortedDrivers = (Array.isArray(dr) ? dr : []).slice().sort((a, b) => toStr(a.name).localeCompare(toStr(b.name)));
      setDeliveries(Array.isArray(d) ? d : []);
      setDrivers(sortedDrivers);
      setOrders(Array.isArray(o) ? o : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load deliveries");
      setDeliveries([]);
      setDrivers([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 800);
  };

  /** API helpers for driver assignment & meta update */
  async function assignDriver(deliveryId: string, driverId: string | null) {
    await api(`/deliveries/${deliveryId}`, {
      method: "PUT",
      body: JSON.stringify({ driverId }),
    });
  }

  const handleAssignDriver = async (deliveryId: string, newDriverId: string) => {
    // Optimistic UI: update local list immediately
    const prev = deliveries;
    const newDriver: Driver | null = newDriverId ? driverById[newDriverId] ?? null : null;

    setDeliveries((cur) => cur.map((d) => (
      d.id === deliveryId ? { ...d, driverId: newDriverId || null, driver: newDriver } : d
    )));

    try {
      setSavingById((s) => ({ ...s, [deliveryId]: true }));
      await assignDriver(deliveryId, newDriverId ? newDriverId : null);
      // final sync to be safe
      await load();
    } catch (e) {
      console.error("Driver assign failed", e);
      alert("Failed to update driver.");
      setDeliveries(prev); // revert
    } finally {
      setSavingById((s) => {
        const { [deliveryId]: _, ...rest } = s;
        return rest;
      });
    }
  };

  const createDelivery = async () => {
    if (!form.orderId) return alert("Select an order to deliver");
    try {
      await api("/deliveries", {
        method: "POST",
        body: JSON.stringify({
          orderId: form.orderId,
          driverId: form.driverId || undefined,
          scheduledDate: form.scheduledDate || undefined,
          notes: form.notes || undefined,
        }),
      });
      setShowCreateModal(false);
      setForm({ orderId: "", driverId: "", scheduledDate: "", notes: "" });
      await load();
    } catch (e) {
      console.error("Failed to create delivery", e);
      alert("Failed to create delivery. Please try again.");
    }
  };

  const updateStatus = async (id: string, status: DeliveryStatus) => {
    try {
      await api(`/deliveries/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      console.error("Failed to update delivery", e);
      alert("Failed to update status.");
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = [...deliveries];

    if (statusFilter !== "all") list = list.filter((d) => d.status === statusFilter);
    if (driverFilter !== "all") list = list.filter((d) => toStr(d.driverId) === driverFilter);
    if (showUnassignedOnly) list = list.filter((d) => !d.driverId);

    if (term) {
      list = list.filter((d) =>
        toStr(d.deliveryNumber).toLowerCase().includes(term) ||
        toStr(d.order?.orderNumber).toLowerCase().includes(term) ||
        toStr(d.order?.customer?.name).toLowerCase().includes(term) ||
        toStr(d.address).toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      let aV: any;
      let bV: any;
      switch (sortBy) {
        case "scheduledDate":
          aV = new Date(a.scheduledDate || 0).getTime();
          bV = new Date(b.scheduledDate || 0).getTime();
          break;
        case "status":
          aV = toStr(a.status);
          bV = toStr(b.status);
          break;
        case "driver":
          aV = toStr(a.driver?.name).toLowerCase();
          bV = toStr(b.driver?.name).toLowerCase();
          break;
        default:
          aV = new Date(a.createdAt || 0).getTime();
          bV = new Date(b.createdAt || 0).getTime();
      }
      if (sortOrder === "asc") return aV > bV ? 1 : -1;
      return aV < bV ? 1 : -1;
    });

    return list;
  }, [deliveries, searchTerm, statusFilter, driverFilter, showUnassignedOnly, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const scheduled = deliveries.filter((d) => d.status === "scheduled").length;
    const out = deliveries.filter((d) => d.status === "out_for_delivery").length;
    const delivered = deliveries.filter((d) => d.status === "delivered").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    return { scheduled, out, delivered, failed };
  }, [deliveries]);

  if (loading) return <DeliveriesSkeleton />;
  if (error)
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 text-center">
        <p className="text-lg font-semibold mb-2">Unable to load deliveries</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={handleRefresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Try Again</button>
      </motion.div>
    );

  return (
    <div className="space-y-6 fade-in max-w-8xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Deliveries</h1>
          <p className="text-muted-foreground">Schedule, assign, and track deliveries</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <RefreshCw className={clsx("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
          <motion.button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Plus className="h-4 w-4" /> New Delivery
          </motion.button>
        </div>
      </motion.div>

      {/* Filters & Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search delivery #, order #, customer, address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>
          <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="all">All Drivers</option>
            {(drivers ?? []).map((d) => (
              <option key={d.id} value={d.id}>{toStr(d.name, "Driver")}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showUnassignedOnly}
              onChange={(e) => setShowUnassignedOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Unassigned only
          </label>
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="createdAt">Sort by Created</option>
              <option value="scheduledDate">Sort by Scheduled</option>
              <option value="status">Sort by Status</option>
              <option value="driver">Sort by Driver</option>
            </select>
            <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors">
              {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />} {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <SummaryTile icon={<Clock className="h-5 w-5" />} label="Scheduled" value={stats.scheduled} className="text-blue-600" />
          <SummaryTile icon={<Truck className="h-5 w-5" />} label="Out for Delivery" value={stats.out} className="text-orange-600" />
          <SummaryTile icon={<PackageCheck className="h-5 w-5" />} label="Delivered" value={stats.delivered} className="text-green-600" />
          <SummaryTile icon={<XCircle className="h-5 w-5" />} label="Failed" value={stats.failed} className="text-red-600" />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">Delivery #</th>
                <th className="text-left p-4 font-medium">Order</th>
                <th className="text-left p-4 font-medium">Customer</th>
                <th className="text-left p-4 font-medium">Driver</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Scheduled</th>
                <th className="text-left p-4 font-medium">Delivered</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filtered ?? []).map((d, index) => {
                const currentId = d.driver?.id ?? d.driverId ?? "";
                const optionExists = currentId ? Boolean(driverById[currentId]) : true;
                const currentLabel = d.driver?.name || (currentId ? "(assigned driver)" : "— Unassigned —");
                return (
                  <motion.tr key={d.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="border-b border-border hover:bg-accent/20 transition-colors">
                    <td className="p-4 font-mono text-sm">{toStr(d.deliveryNumber, "-")}</td>
                    <td className="p-4">{toStr(d.order?.orderNumber, "-")}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{toStr(d.order?.customer?.name, "-")}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                        <select
                          value={currentId}
                          disabled={!!savingById[d.id]}
                          onChange={(e) => handleAssignDriver(d.id, e.target.value)}
                          className="min-w-[12rem] px-2 py-1 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                          title={currentLabel}
                        >
                          {/* When the current driver isn't in the drivers list (e.g., filtered/deleted), show a synthetic option so the UI reflects the assignment */}
                          {!optionExists && currentId && (
                            <option value={currentId}>{currentLabel}</option>
                          )}
                          <option value="">{savingById[d.id] ? "Saving..." : "— Unassigned —"}</option>
                          {(drivers ?? []).map((drv) => (
                            <option key={drv.id} value={drv.id}>{toStr(drv.name, "Driver")}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignDriver(d.id, "")}
                          disabled={!!savingById[d.id] || !currentId}
                          className="px-2 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-50"
                          title="Unassign driver"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                    <td className="p-4"><StatusBadge status={d.status} /></td>
                    <td className="p-4 text-sm text-muted-foreground">{dateLabel(d.scheduledDate)}</td>
                    <td className="p-4 text-sm text-muted-foreground">{dateLabel(d.deliveredAt)}</td>
                    <td className="p-4 text-right">
                      <div className="inline-flex gap-2">
                        {d.status === "scheduled" && (
                          <button onClick={() => updateStatus(d.id, "out_for_delivery")} className="px-3 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-sm inline-flex items-center gap-2">
                            <Truck className="h-4 w-4" /> Start
                          </button>
                        )}
                        {d.status === "out_for_delivery" && (
                          <button onClick={() => updateStatus(d.id, "delivered")} className="px-3 py-1 rounded-lg bg-green-600/90 text-white hover:bg-green-700 inline-flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4" /> Delivered
                          </button>
                        )}
                        {(d.status === "scheduled" || d.status === "out_for_delivery") && (
                          <button onClick={() => updateStatus(d.id, "failed")} className="px-3 py-1 rounded-lg hover:bg-destructive/10 text-destructive inline-flex items-center gap-2 text-sm">
                            <XCircle className="h-4 w-4" /> Failed
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Create Delivery Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateDeliveryModal
            form={form}
            setForm={setForm}
            orders={orders}
            drivers={drivers}
            onSubmit={createDelivery}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/********************* UI bits *********************/
function StatusBadge({ status }: { status: DeliveryStatus }) {
  const map: Record<DeliveryStatus, string> = {
    scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    out_for_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return <span className={clsx("px-2 py-1 text-xs font-medium rounded-full", map[status])}>{status.replaceAll("_", " ")}</span>;
}

function SummaryTile({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: number | string; className?: string }) {
  return (
    <div className="text-center">
      <div className={clsx("text-2xl font-bold flex items-center gap-2 justify-center", className)}>
        {icon} {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

/********************* Create Modal *********************/
function CreateDeliveryModal({ form, setForm, orders, drivers, onSubmit, onClose }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-2xl card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">New Delivery</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Order *</label>
            <select value={form.orderId} onChange={(e) => setForm((s: any) => ({ ...s, orderId: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Select Order</option>
              {(orders ?? []).map((o: OrderLite) => (
                <option key={o.id} value={o.id}>#{o.orderNumber} — {toStr(o.customer?.name, "Customer")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Driver</label>
            <select value={form.driverId} onChange={(e) => setForm((s: any) => ({ ...s, driverId: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Unassigned</option>
              {(drivers ?? []).map((d: Driver) => (
                <option key={d.id} value={d.id}>{toStr(d.name, "Driver")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Scheduled Date/Time</label>
            <input type="datetime-local" value={form.scheduledDate} onChange={(e) => setForm((s: any) => ({ ...s, scheduledDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <input value={form.notes} onChange={(e) => setForm((s: any) => ({ ...s, notes: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Optional instructions" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onSubmit} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Create Delivery</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/********************* Skeleton *********************/
function DeliveriesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 w-32 bg-muted rounded" />
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>

      <div className="card p-0">
        <div className="p-4 border-b">
          <div className="grid grid-cols-8 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-border">
            <div className="grid grid-cols-8 gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
