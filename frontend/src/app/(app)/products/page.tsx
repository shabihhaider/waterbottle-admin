"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCw,
  Package,
  Boxes,
  TriangleAlert,
  TrendingUp,
  SortAsc,
  SortDesc,
  Grid2X2,
  Table as TableIcon,
  Plus,
} from "lucide-react";
import clsx from "clsx";

/********************* Types *********************/
interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  unit?: string; // e.g., "bottle", "carton"
  stock: number;
  lowStockLevel: number; // threshold
  salePrice: number;
  costPrice?: number;
  status?: "active" | "inactive";
  updatedAt?: string;
  description?: string;
}

/********************* Safe helpers *********************/
const toStr = (v: unknown, fb = ""): string => (v === undefined || v === null ? fb : String(v));
const numOr0 = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtInt = (v: unknown, fb = "0") => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : fb);
const dateLabel = (iso?: string, fb = "-") => (iso ? new Date(iso).toLocaleDateString() : fb);

const EMPTY_PRODUCT: Product = {
  id: "",
  sku: "",
  name: "Unnamed",
  stock: 0,
  lowStockLevel: 0,
  salePrice: 0,
  status: "active",
};

const sanitizeProduct = (p: Partial<Product> | null | undefined): Product => ({
  ...EMPTY_PRODUCT,
  id: toStr(p?.id, crypto.randomUUID()),
  sku: toStr(p?.sku, "-"),
  name: toStr(p?.name, "Unnamed"),
  category: p?.category ? toStr(p.category) : undefined,
  unit: p?.unit ? toStr(p.unit) : undefined,
  stock: numOr0(p?.stock),
  lowStockLevel: numOr0(p?.lowStockLevel),
  salePrice: numOr0(p?.salePrice),
  costPrice: p?.costPrice !== undefined ? numOr0(p.costPrice) : undefined,
  status: (p?.status as Product["status"]) || "active",
  updatedAt: p?.updatedAt,
  description: p?.description ? toStr(p.description) : undefined,
});

/********************* Page *********************/
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | low | out | active | inactive
  const [sortBy, setSortBy] = useState("name"); // name | stock | price | updatedAt
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [refreshing, setRefreshing] = useState(false);

  // Add Inventory modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    unit: "bottle",
    stock: 0,
    lowStockLevel: 5,
    salePrice: 0,
    costPrice: 0,
    status: "active" as "active" | "inactive",
    description: "",
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<Product[]>("/products");
      const safe = Array.isArray(res) ? res.map(sanitizeProduct) : [];
      setProducts(safe);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const id = setInterval(loadProducts, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleAddProduct = async () => {
    try {
      const payload = {
        sku: toStr(formData.sku).trim(),
        name: toStr(formData.name).trim(),
        category: toStr(formData.category).trim() || undefined,
        unit: toStr(formData.unit).trim() || undefined,
        stock: numOr0(formData.stock),
        lowStockLevel: numOr0(formData.lowStockLevel),
        salePrice: numOr0(formData.salePrice),
        costPrice: numOr0(formData.costPrice) || undefined,
        status: formData.status,
        description: toStr(formData.description).trim() || undefined,
      };

      if (!payload.sku || !payload.name) {
        alert("SKU and Name are required");
        return;
      }

      await api("/products", { method: "POST", body: JSON.stringify(payload) });
      setShowAddModal(false);
      setFormData({
        sku: "",
        name: "",
        category: "",
        unit: "bottle",
        stock: 0,
        lowStockLevel: 5,
        salePrice: 0,
        costPrice: 0,
        status: "active",
        description: "",
      });
      loadProducts();
    } catch (e) {
      console.error("Failed to add product", e);
      alert("Failed to add product. Please try again.");
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = products.filter((p) => {
      const matchesSearch = !term
        ? true
        : toStr(p.name).toLowerCase().includes(term) ||
          toStr(p.sku).toLowerCase().includes(term) ||
          toStr(p.category).toLowerCase().includes(term);

      const isLow = p.stock <= p.lowStockLevel && p.stock > 0;
      const isOut = p.stock <= 0;

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "low" && isLow) ||
        (statusFilter === "out" && isOut) ||
        (statusFilter === "active" && p.status === "active") ||
        (statusFilter === "inactive" && p.status === "inactive");

      return matchesSearch && matchStatus;
    });

    list.sort((a, b) => {
      let aV: any;
      let bV: any;
      switch (sortBy) {
        case "stock":
          aV = a.stock;
          bV = b.stock;
          break;
        case "price":
          aV = a.salePrice;
          bV = b.salePrice;
          break;
        case "updatedAt":
          aV = new Date(a.updatedAt || 0).getTime();
          bV = new Date(b.updatedAt || 0).getTime();
          break;
        default:
          aV = toStr(a.name).toLowerCase();
          bV = toStr(b.name).toLowerCase();
      }
      if (sortOrder === "asc") return aV > bV ? 1 : -1;
      return aV < bV ? 1 : -1;
    });

    return list;
  }, [products, searchTerm, statusFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const total = products.length;
    const low = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockLevel).length;
    const out = products.filter((p) => p.stock <= 0).length;
    const stockValue = products.reduce((sum, p) => sum + p.stock * p.salePrice, 0);
    return { total, low, out, stockValue };
  }, [products]);

  if (loading) return <ProductsSkeleton />;
  if (error)
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 text-center"
      >
        <p className="text-lg font-semibold mb-2">Unable to load inventory</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={loadProducts}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Try Again
        </button>
      </motion.div>
    );

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Inventory
          </h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className={clsx("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>

          <motion.button
            onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {viewMode === "table" ? (
              <span className="flex items-center gap-2">
                <Grid2X2 className="h-4 w-4" /> Grid View
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <TableIcon className="h-4 w-4" /> Table View
              </span>
            )}
          </motion.button>

          <motion.button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            Add Inventory
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search SKU, name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="name">Sort by Name</option>
            <option value="stock">Sort by Stock</option>
            <option value="price">Sort by Price</option>
            <option value="updatedAt">Sort by Updated</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors"
          >
            {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary flex items-center gap-2 justify-center">
              <Boxes className="h-5 w-5" /> {stats.total}
            </div>
            <div className="text-sm text-muted-foreground">Total SKUs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 flex items-center gap-2 justify-center">
              <TriangleAlert className="h-5 w-5" /> {stats.low}
            </div>
            <div className="text-sm text-muted-foreground">Low Stock</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 flex items-center gap-2 justify-center">
              <Package className="h-5 w-5" /> {stats.out}
            </div>
            <div className="text-sm text-muted-foreground">Out of Stock</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 flex items-center gap-2 justify-center">
              <TrendingUp className="h-5 w-5" /> {formatPKR(stats.stockValue)}
            </div>
            <div className="text-sm text-muted-foreground">Stock Value (Sale)</div>
          </div>
        </div>
      </motion.div>

      {/* List */}
      <AnimatePresence mode="wait">
        {viewMode === "table" ? (
          <TableView key="table" products={filtered} />
        ) : (
          <GridView key="grid" products={filtered} />
        )}
      </AnimatePresence>

      {/* Add Inventory Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddInventoryModal
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAddProduct}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/********************* Table View *********************/
function TableView({ products }: { products: Product[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left p-4 font-medium">SKU</th>
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Category</th>
              <th className="text-left p-4 font-medium">Stock</th>
              <th className="text-left p-4 font-medium">Reorder @</th>
              <th className="text-left p-4 font-medium">Sale Price</th>
              <th className="text-left p-4 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p, i) => {
              const low = p.stock <= p.lowStockLevel && p.stock > 0;
              const out = p.stock <= 0;
              return (
                <motion.tr key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="border-b border-border hover:bg-accent/20 transition-colors">
                  <td className="p-4 font-mono text-sm">{toStr(p.sku, "-")}</td>
                  <td className="p-4">
                    <div className="font-medium">{toStr(p.name, "Unnamed")}</div>
                    {p.unit && <div className="text-xs text-muted-foreground">per {toStr(p.unit)}</div>}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{toStr(p.category, "-")}</td>
                  <td className={clsx("p-4 font-medium", out && "text-red-600", low && !out && "text-orange-600")}>{fmtInt(p.stock)}</td>
                  <td className="p-4 text-sm">{fmtInt(p.lowStockLevel)}</td>
                  <td className="p-4 font-medium">{formatPKR(numOr0(p.salePrice))}</td>
                  <td className="p-4 text-sm text-muted-foreground">{dateLabel(p.updatedAt)}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/********************* Grid View *********************/
function GridView({ products }: { products: Product[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {(products ?? []).map((p, i) => {
        const low = p.stock <= p.lowStockLevel && p.stock > 0;
        const out = p.stock <= 0;
        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }} className={clsx("card p-5 card-hover", out && "ring-2 ring-red-200 dark:ring-red-800", low && !out && "ring-2 ring-orange-200 dark:ring-orange-800")}> 
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs font-mono text-muted-foreground">{toStr(p.sku, "-")}</div>
                <h3 className="text-lg font-semibold mt-1">{toStr(p.name)}</h3>
                <div className="text-xs text-muted-foreground">{toStr(p.category, "Uncategorized")}</div>
              </div>
              <div className="text-right">
                <div className={clsx("text-xl font-bold", out && "text-red-600", low && !out && "text-orange-600")}>{fmtInt(p.stock)}</div>
                <div className="text-xs text-muted-foreground">in stock</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <div className="text-xs text-blue-600/80">Reorder @</div>
                <div className="font-semibold text-blue-600">{fmtInt(p.lowStockLevel)}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <div className="text-xs text-green-600/80">Sale Price</div>
                <div className="font-semibold text-green-600">{formatPKR(numOr0(p.salePrice))}</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
                <div className="text-xs text-purple-600/80">Updated</div>
                <div className="font-semibold text-purple-600">{dateLabel(p.updatedAt)}</div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/********************* Add Inventory Modal *********************/
function AddInventoryModal({
  formData,
  setFormData,
  onSubmit,
  onClose,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Add Inventory</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">✕</button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium mb-2">SKU *</label>
            <input
              required
              value={formData.sku}
              onChange={(e) => setFormData((s: any) => ({ ...s, sku: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="WTR-19L"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData((s: any) => ({ ...s, name: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="19L Water Bottle"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <input
              value={formData.category}
              onChange={(e) => setFormData((s: any) => ({ ...s, category: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Water / Accessories"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Unit</label>
            <input
              value={formData.unit}
              onChange={(e) => setFormData((s: any) => ({ ...s, unit: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="bottle, carton, pack"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Opening Stock</label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData((s: any) => ({ ...s, stock: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reorder Level</label>
            <input
              type="number"
              value={formData.lowStockLevel}
              onChange={(e) => setFormData((s: any) => ({ ...s, lowStockLevel: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sale Price (Rs.)</label>
            <input
              type="number"
              value={formData.salePrice}
              onChange={(e) => setFormData((s: any) => ({ ...s, salePrice: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Cost Price (Rs.)</label>
            <input
              type="number"
              value={formData.costPrice}
              onChange={(e) => setFormData((s: any) => ({ ...s, costPrice: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((s: any) => ({ ...s, status: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((s: any) => ({ ...s, description: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Optional: short description"
              rows={3}
            />
          </div>

          <div className="md:col-span-2 flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Add Product
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/********************* Skeleton *********************/
function ProductsSkeleton() {
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
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-border">
            <div className="grid grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
