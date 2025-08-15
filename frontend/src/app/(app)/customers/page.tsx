"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Eye,
  Trash2,
  SortAsc,
  SortDesc,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";

/********************* Types *********************/
interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
  status: "active" | "inactive" | "vip";
  rating: number;
  joinDate: string;
  notes?: string;
  creditLimit: number;
  outstandingBalance: number;
}

/********************* Safe helpers *********************/
const toStr = (v: unknown, fb = ""): string =>
  v === undefined || v === null ? fb : String(v);
const numOr0 = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;
const dateLabel = (iso?: string, fb = "-") =>
  iso ? new Date(iso).toLocaleDateString() : fb;
const fmtInt = (v: unknown, fb = "0") =>
  Number.isFinite(Number(v)) ? Number(v).toLocaleString() : fb;

const EMPTY_CUSTOMER: Customer = {
  id: "",
  name: "",
  totalOrders: 0,
  totalSpent: 0,
  status: "inactive",
  rating: 0,
  joinDate: new Date().toISOString(),
  creditLimit: 0,
  outstandingBalance: 0,
};

const sanitizeCustomer = (c: Partial<Customer> | undefined | null): Customer => ({
  ...EMPTY_CUSTOMER,
  id: toStr(c?.id, crypto.randomUUID()),
  name: toStr(c?.name, "Unnamed"),
  phone: c?.phone ? toStr(c.phone) : undefined,
  email: c?.email ? toStr(c.email) : undefined,
  address: c?.address ? toStr(c.address) : undefined,
  totalOrders: numOr0(c?.totalOrders),
  totalSpent: numOr0(c?.totalSpent),
  lastOrderDate: c?.lastOrderDate,
  status: (c?.status as Customer["status"]) || "inactive",
  rating: Math.max(0, Math.min(5, numOr0(c?.rating))),
  joinDate: toStr(c?.joinDate, new Date().toISOString()),
  notes: c?.notes ? toStr(c.notes) : undefined,
  creditLimit: numOr0(c?.creditLimit),
  outstandingBalance: numOr0(c?.outstandingBalance),
});

/********************* UI Helpers (single source) *********************/
function StatusBadge({ status }: { status: Customer["status"] }) {
  const styles: Record<Customer["status"], string> = {
    active:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    inactive:
      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    vip: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return (
    <span className={clsx("px-2 py-1 text-xs font-medium rounded-full", styles[status])}>
      {status.toUpperCase()}
    </span>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={clsx(
            "h-4 w-4",
            star <= rating ? "text-yellow-400 fill-current" : "text-gray-300"
          )}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.802-2.034a1 1 0 00-1.175 0l-2.802 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/********************* Page *********************/
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    creditLimit: 0,
    notes: "",
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<Customer[]>("/customers");
      const safe = Array.isArray(res) ? res.map(sanitizeCustomer) : [];
      setCustomers(safe);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    const id = setInterval(loadCustomers, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setTimeout(() => setRefreshing(false), 800);
  };

  // derived: filtered + sorted
  useEffect(() => {
    let filtered = customers.filter((c) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term
        ? true
        : toStr(c.name).toLowerCase().includes(term) ||
          toStr(c.phone).toLowerCase().includes(term) ||
          toStr(c.email).toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let aV: any;
      let bV: any;
      switch (sortBy) {
        case "name":
          aV = toStr(a.name).toLowerCase();
          bV = toStr(b.name).toLowerCase();
          break;
        case "totalSpent":
          aV = a.totalSpent;
          bV = b.totalSpent;
          break;
        case "totalOrders":
          aV = a.totalOrders;
          bV = b.totalOrders;
          break;
        case "joinDate":
          aV = new Date(a.joinDate).getTime();
          bV = new Date(b.joinDate).getTime();
          break;
        default:
          aV = toStr(a.name).toLowerCase();
          bV = toStr(b.name).toLowerCase();
      }
      if (sortOrder === "asc") return aV > bV ? 1 : -1;
      return aV < bV ? 1 : -1;
    });

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, statusFilter, sortBy, sortOrder]);

  const toNum = (v: any) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);

  // replace your current handleAddCustomer with this:
  async function handleAddCustomer() {
    try {
      const toNum = (v: any) =>
        v === '' || v === null || v === undefined ? 0 : Number(v) || 0;

      // Send only fields the backend schema expects.
      const payload = {
        name: (formData.name || '').trim(),
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        creditLimit: toNum(formData.creditLimit),
        notes: formData.notes?.trim() || undefined,
        // status/rating are optional in backend and have defaults,
        // so we omit them to avoid validation errors.
      };

      if (!payload.name) throw new Error('Name is required');

      await api('/customers', {
        method: 'POST',
        body: payload, // api() handles JSON headers/stringify
      });

      // reset/refresh UI — keep the same shape as initial formData
      setShowAddModal(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        creditLimit: 0,
        notes: '',
      });
      await loadCustomers();
    } catch (err: any) {
      console.error('Failed to add customer', err);
      alert(err?.message || 'Failed to add customer');
    }
  }


  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await api(`/customers/${id}`, { method: "DELETE" });
      loadCustomers();
    } catch (e) {
      console.error("Failed to delete customer", e);
    }
  };

  if (loading) return <CustomersSkeleton />;
  if (error)
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 text-center"
      >
        <p className="text-lg font-semibold mb-2">Unable to load customers</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={loadCustomers}
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
            Customers
          </h1>
          <p className="text-muted-foreground">Manage your water delivery customers</p>
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
            {viewMode === "table" ? "Grid View" : "Table View"}
          </motion.button>

          <motion.button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </motion.button>
        </div>
      </motion.div>

      {/* Filters & Search */}
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
              placeholder="Search customers..."
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
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="vip">VIP</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="name">Sort by Name</option>
            <option value="totalSpent">Sort by Spending</option>
            <option value="totalOrders">Sort by Orders</option>
            <option value="joinDate">Sort by Join Date</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors"
          >
            {sortOrder === "asc" ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
            {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{filteredCustomers.length}</div>
            <div className="text-sm text-muted-foreground">Shown Customers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {customers.filter((c) => c.status === "active").length}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {customers.filter((c) => c.status === "vip").length}
            </div>
            <div className="text-sm text-muted-foreground">VIP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {customers.filter((c) => c.outstandingBalance > 0).length}
            </div>
            <div className="text-sm text-muted-foreground">Outstanding</div>
          </div>
        </div>
      </motion.div>

      {/* List */}
      <AnimatePresence mode="wait">
        {viewMode === "table" ? (
          <TableView
            key="table"
            customers={filteredCustomers}
            onView={(c) => {
              setSelectedCustomer(c);
              setShowDetailModal(true);
            }}
            onDelete={handleDeleteCustomer}
          />
        ) : (
          <GridView
            key="grid"
            customers={filteredCustomers}
            onView={(c) => {
              setSelectedCustomer(c);
              setShowDetailModal(true);
            }}
            onDelete={handleDeleteCustomer}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddCustomerModal
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAddCustomer}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetailModal && selectedCustomer && (
          <CustomerDetailModal
            customer={selectedCustomer}
            onClose={() => setShowDetailModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/********************* Table View *********************/
function TableView({
  customers,
  onView,
  onDelete,
}: {
  customers: Customer[];
  onView: (c: Customer) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="card p-0 overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left p-4 font-medium">Customer</th>
              <th className="text-left p-4 font-medium">Contact</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Orders</th>
              <th className="text-left p-4 font-medium">Total Spent</th>
              <th className="text-left p-4 font-medium">Outstanding</th>
              <th className="text-left p-4 font-medium">Rating</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c, index) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-border hover:bg-accent/20 transition-colors"
              >
                <td className="p-4">
                  <div>
                    <div className="font-medium">{toStr(c.name, "Unnamed")}</div>
                    <div className="text-sm text-muted-foreground">
                      Joined {dateLabel(c.joinDate)}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="space-y-1">
                    {c.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3" />
                        {toStr(c.phone)}
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3" />
                        {toStr(c.email)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <StatusBadge status={c.status} />
                </td>
                <td className="p-4">
                  <div className="font-medium">{fmtInt(c.totalOrders)}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.lastOrderDate
                      ? `Last: ${dateLabel(c.lastOrderDate)}`
                      : "No orders"}
                  </div>
                </td>
                <td className="p-4">
                  <div className="font-medium">{formatPKR(numOr0(c.totalSpent))}</div>
                </td>
                <td className="p-4">
                  <div
                    className={clsx(
                      "font-medium",
                      c.outstandingBalance > 0 ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {formatPKR(numOr0(c.outstandingBalance))}
                  </div>
                </td>
                <td className="p-4">
                  <Stars rating={numOr0(c.rating)} />
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(c)}
                      className="p-2 hover:bg-accent rounded-lg transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/********************* Grid View *********************/
function GridView({
  customers,
  onView,
  onDelete,
}: {
  customers: Customer[];
  onView: (c: Customer) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {(customers ?? []).map((c, index) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -4 }}
          className="card p-6 card-hover"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{toStr(c.name, "Unnamed")}</h3>
              <StatusBadge status={c.status} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onView(c)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {c.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {toStr(c.phone)}
              </div>
            )}

            {c.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {toStr(c.email)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-sm text-muted-foreground">Orders</div>
                <div className="font-semibold">{fmtInt(c.totalOrders)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Spent</div>
                <div className="font-semibold">{formatPKR(numOr0(c.totalSpent))}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Stars rating={numOr0(c.rating)} />
              {c.outstandingBalance > 0 && (
                <span className="text-sm text-red-600 font-medium">
                  Outstanding: {formatPKR(numOr0(c.outstandingBalance))}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/********************* Add Customer Modal *********************/
function AddCustomerModal({ formData, setFormData, onSubmit, onClose }: any) {
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
        className="w-full max-w-md card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Add New Customer</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="+92 300 1234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="customer@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Delivery address"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Credit Limit (Rs.)</label>
            <input
              type="number"
              value={formData.creditLimit}
              onChange={(e) =>
                setFormData({ ...formData, creditLimit: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Additional notes about the customer"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
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
              Add Customer
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/********************* Detail Modal *********************/
function CustomerDetailModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

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
        className="w-full max-w-4xl card p-0 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {toStr(customer.name, "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{toStr(customer.name, "Unnamed")}</h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={customer.status} />
                <Stars rating={numOr0(customer.rating)} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: "overview", label: "Overview" },
            { id: "orders", label: "Order History" },
            { id: "payments", label: "Payments" },
            { id: "notes", label: "Notes" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-6 py-3 font-medium transition-colors",
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Contact Information</h3>
                  {customer.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{toStr(customer.phone)}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{toStr(customer.email)}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <span>{toStr(customer.address)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Joined {dateLabel(customer.joinDate)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Business Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{fmtInt(customer.totalOrders)}</div>
                      <div className="text-sm text-blue-600/80">Total Orders</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {formatPKR(numOr0(customer.totalSpent))}
                      </div>
                      <div className="text-sm text-green-600/80">Total Spent</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatPKR(numOr0(customer.creditLimit))}
                      </div>
                      <div className="text-sm text-purple-600/80">Credit Limit</div>
                    </div>
                    <div
                      className={clsx(
                        "p-4 rounded-lg",
                        customer.outstandingBalance > 0
                          ? "bg-red-50 dark:bg-red-950"
                          : "bg-green-50 dark:bg-green-950"
                      )}
                    >
                      <div
                        className={clsx(
                          "text-2xl font-bold",
                          customer.outstandingBalance > 0
                            ? "text-red-600"
                            : "text-green-600"
                        )}
                      >
                        {formatPKR(numOr0(customer.outstandingBalance))}
                      </div>
                      <div
                        className={clsx(
                          "text-sm",
                          customer.outstandingBalance > 0
                            ? "text-red-600/80"
                            : "text-green-600/80"
                        )}
                      >
                        Outstanding
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity (placeholder) */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {[
                    { date: "2025-07-15", action: "Order placed", details: "Order #1234 - 5x 19L Water Bottles" },
                    { date: "2025-07-10", action: "Payment received", details: "Rs. 1,250 for Order #1230" },
                    { date: "2025-07-05", action: "Order delivered", details: "Order #1230 delivered successfully" },
                  ].map((a, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-accent/20 rounded-lg">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                      <div className="flex-1">
                        <div className="font-medium">{a.action}</div>
                        <div className="text-sm text-muted-foreground">{a.details}</div>
                        <div className="text-xs text-muted-foreground mt-1">{a.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Order History</h3>
              <div className="text-center py-8 text-muted-foreground">
                Order history will be displayed here
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Payment History</h3>
              <div className="text-center py-8 text-muted-foreground">
                Payment history will be displayed here
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Customer Notes</h3>
              <div className="p-4 bg-accent/20 rounded-lg">
                <p className="text-muted-foreground">
                  {toStr(customer.notes, "No notes available for this customer.")}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/********************* Skeleton *********************/
function CustomersSkeleton() {
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
        {Array.from({ length: 5 }).map((_, i) => (
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
