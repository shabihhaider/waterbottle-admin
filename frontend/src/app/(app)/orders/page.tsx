"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Plus,
  Search,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  X,
  SortAsc,
  SortDesc,
} from "lucide-react";
import clsx from "clsx";

/********************* Types *********************/
interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: { id: string; name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  customerId: string;
  customer?: { id: string; name: string };
  items: OrderItem[];
  total?: number;                // <-- was: number
  createdAt?: string;
}

interface Customer { id: string; name: string }
interface Product { id: string; name: string; salePrice: number }

/********************* Safe helpers *********************/
const toStr = (v: unknown, fb = ""): string => (v === undefined || v === null ? fb : String(v));
const numOr0 = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtInt = (v: unknown, fb = "0") => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : fb);
const dateLabel = (iso?: string, fb = "-") => (iso ? new Date(iso).toLocaleString() : fb);
const orderItemsTotal = (items: OrderItem[] = []) =>
  items.reduce((s, i) => s + numOr0(i.quantity) * numOr0(i.unitPrice), 0);

/********************* Page *********************/
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // filters/sort
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Create Order modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<OrderItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [o, c, p] = await Promise.all([
        api<Order[]>("/orders"),
        api<Customer[]>("/customers"),
        api<Product[]>("/products"),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setCustomers(Array.isArray(c) ? c : []);
      setProducts(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load data");
      setOrders([]);
      setCustomers([]);
      setProducts([]);
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

  /********** Create order helpers **********/
  const addItem = () => {
    const prod = products.find((p) => p.id === productId);
    if (!prod || qty <= 0) return;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [
        ...prev,
        { productId: prod.id, quantity: qty, unitPrice: numOr0(prod.salePrice), product: { id: prod.id, name: prod.name } },
      ];
    });
    setProductId("");
    setQty(1);
  };

  const removeItem = (pid: string) => setItems((prev) => prev.filter((i) => i.productId !== pid));

  const orderTotal = useMemo(
    () => items.reduce((s, i) => s + numOr0(i.quantity) * numOr0(i.unitPrice), 0),
    [items]
  );

// replace your current `create` with this
const create = async () => {
  if (!customerId || items.length === 0) return alert("Pick a customer and add at least one item.");
  try {
    await api("/orders", {
      method: "POST",
      // IMPORTANT: pass a plain object (not JSON.stringify)
      body: {
        customerId,
        items: items.map(({ productId, quantity, unitPrice }) => ({
          productId,
          quantity,
          unitPrice,
        })),
      },
    });
    setShowCreateModal(false);
    setCustomerId("");
    setItems([]);
    await load();
  } catch (e: any) {
    console.error("Failed to create order", e);
    alert(e?.message || "Failed to create order. Please try again.");
  }
};


  /********** Filters & sorting **********/
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = [...orders];

    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);

    if (term) {
      list = list.filter((o) =>
        toStr(o.orderNumber).toLowerCase().includes(term) ||
        toStr(o.customer?.name).toLowerCase().includes(term) ||
        toStr(o.items?.map((i) => i.product?.name).join(", ")).toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      let aV: any;
      let bV: any;
      switch (sortBy) {
        case "total":
          aV = numOr0(a.total ?? orderItemsTotal(a.items));
          bV = numOr0(b.total ?? orderItemsTotal(b.items));
          break;
        case "createdAt":
          aV = new Date(a.createdAt || 0).getTime();
          bV = new Date(b.createdAt || 0).getTime();
          break;
        case "orderNumber":
          aV = toStr(a.orderNumber).toLowerCase();
          bV = toStr(b.orderNumber).toLowerCase();
          break;
        case "total":
          aV = numOr0(a.total);
          bV = numOr0(b.total);
          break;
        default:
          aV = new Date(a.createdAt || 0).getTime();
          bV = new Date(b.createdAt || 0).getTime();
      }
      if (sortOrder === "asc") return aV > bV ? 1 : -1;
      return aV < bV ? 1 : -1;
    });

    return list;
  }, [orders, searchTerm, statusFilter, sortBy, sortOrder]);

  /********** UI **********/
  if (loading) return <OrdersSkeleton />;
  if (error)
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 text-center">
        <p className="text-lg font-semibold mb-2">Unable to load orders</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={handleRefresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Try Again</button>
      </motion.div>
    );

  return (
    <div className="space-y-6 fade-in max-w-8xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Orders</h1>
          <p className="text-muted-foreground">Create and track customer orders</p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <RefreshCw className={clsx("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
          <motion.button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Plus className="h-4 w-4" /> New Order
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search order #, customer or item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="createdAt">Sort by Date</option>
            <option value="orderNumber">Sort by Order #</option>
            <option value="total">Sort by Total</option>
          </select>
          <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors">
            {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />} {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
      </motion.div>

      {/* Orders Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">#</th>
                <th className="text-left p-4 font-medium">Customer</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Items</th>
                <th className="text-left p-4 font-medium">Total</th>
                <th className="text-left p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(filtered ?? []).map((o, index) => (
                <motion.tr key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="border-b border-border hover:bg-accent/20 transition-colors">
                  <td className="p-4">{toStr(o.orderNumber, "-")}</td>
                  <td className="p-4">{toStr(o.customer?.name, "-")}</td>
                  <td className="p-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {toStr(o.items?.map((i) => `${toStr(i.product?.name, "Item")}×${fmtInt(i.quantity)}`).join(", "), "-")}
                  </td>
                  <td className="p-4 font-medium">
                    {formatPKR(orderItemsTotal(o.items))}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{dateLabel(o.createdAt)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Create Order Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateOrderModal
            customers={customers}
            products={products}
            customerId={customerId}
            setCustomerId={setCustomerId}
            productId={productId}
            setProductId={setProductId}
            qty={qty}
            setQty={setQty}
            items={items}
            addItem={addItem}
            removeItem={removeItem}
            orderTotal={orderTotal}
            onSubmit={create}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/********************* Status Badge *********************/
function StatusBadge({ status }: { status: Order["status"] }) {
  const map: Record<Order["status"], string> = {
    pending: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return <span className={clsx("px-2 py-1 text-xs font-medium rounded-full", map[status])}>{status.toUpperCase()}</span>;
}

/********************* Create Order Modal *********************/
function CreateOrderModal({
  customers,
  products,
  customerId,
  setCustomerId,
  productId,
  setProductId,
  qty,
  setQty,
  items,
  addItem,
  removeItem,
  orderTotal,
  onSubmit,
  onClose,
}: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-3xl card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Create Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">Select Customer</option>
            {(customers ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{toStr(c.name, "Unnamed")}</option>
            ))}
          </select>

          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">Select Product</option>
            {(products ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{toStr(p.name, "Product")}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <button onClick={addItem} className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80">Add</button>
          </div>
        </div>

        {/* Items */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Items</h3>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items added yet</div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-3">Product</th>
                    <th className="text-left p-3">Qty</th>
                    <th className="text-left p-3">Unit Price</th>
                    <th className="text-left p-3">Line Total</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i: any) => (
                    <tr key={i.productId} className="border-t border-border">
                      <td className="p-3">{toStr(i.product?.name, "Item")}</td>
                      <td className="p-3">{fmtInt(i.quantity)}</td>
                      <td className="p-3">{formatPKR(numOr0(i.unitPrice))}</td>
                      <td className="p-3 font-medium">{formatPKR(numOr0(i.quantity) * numOr0(i.unitPrice))}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => removeItem(i.productId)} className="px-3 py-1 text-sm rounded-lg hover:bg-destructive/10 text-destructive">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">Total items: {fmtInt(items.reduce((s: number, i: any) => s + numOr0(i.quantity), 0))}</div>
            <div className="text-lg font-semibold">Order Total: {formatPKR(orderTotal)}</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onSubmit} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Create Order</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/********************* Skeleton *********************/
function OrdersSkeleton() {
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
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-border">
            <div className="grid grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
