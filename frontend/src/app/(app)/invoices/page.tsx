"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Plus,
  Search,
  SortAsc,
  SortDesc,
  FileText,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import clsx from "clsx";

/********************* Types *********************/
interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { id: string; name: string };
  items: InvoiceItem[];
  total: number;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"; // <— changed
  pdfUrl?: string;
  createdAt?: string;
  dueDate?: string;
  notes?: string;
}

interface Customer { id: string; name: string }

/********************* Safe helpers *********************/
const toStr = (v: unknown, fb = ""): string => (v === undefined || v === null ? fb : String(v));
const numOr0 = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtInt = (v: unknown, fb = "0") => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : fb);
const dateLabel = (iso?: string, fb = "-") => (iso ? new Date(iso).toLocaleDateString() : fb);
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const API_ORIGIN = API_BASE.replace(/\/api$/, ''); // ← http://127.0.0.1:5050

/********************* Page *********************/
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // filters/sort
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // create invoice modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // replace the whole function
const openPdf = async (invId: string) => {
  try {
    const { url } = await api<{ url?: string }>(`/invoices/${invId}/pdf`);

    // Accept absolute (e.g., S3) or relative (e.g., /api/invoices/:id/pdf/raw)
    let finalUrl = url || '';
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      // Make it absolute against the API origin (no double /api anymore)
      finalUrl = `${API_ORIGIN}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
    }

    if (finalUrl) {
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('PDF not available yet.');
    }
  } catch (e: any) {
    console.error('Failed to open PDF', e);
    const msg =
      e?.body?.error ||
      e?.message ||
      'Failed to open PDF.';
    alert(msg);
  }
};

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [inv, cust] = await Promise.all([
        api<Invoice[]>("/invoices"),
        api<Customer[]>("/customers"),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setCustomers(Array.isArray(cust) ? cust : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load invoices");
      setInvoices([]);
      setCustomers([]);
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

  const addBlankItem = () =>
    setItems((s) => [...s, { name: "19L Water Bottle", qty: 1, price: 250 }]);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const invoiceSubtotal = useMemo(
    () => items.reduce((s, it) => s + numOr0(it.qty) * numOr0(it.price), 0),
    [items]
  );

  // replace your current create() with this
// --- REPLACE the create() function with this ---
const create = async () => {
  if (!customerId || items.length === 0) {
    return alert("Select a customer and add at least one item.");
  }

  // normalize + validate payload the backend expects
  const cleanItems = items.map((it) => ({
    name: toStr(it.name).trim() || "Item",
    qty: Math.max(1, numOr0(it.qty)),
    price: Math.max(0, numOr0(it.price)),
  }));

  // HTML <input type="date"> gives "YYYY-MM-DD" — make it ISO
  const isoDue = dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : undefined;

  try {
    await api("/invoices", {
      method: "POST",
      body: {
        customerId,
        items: cleanItems,
        dueDate: isoDue,
        notes: notes?.trim() || undefined,
      }, // <-- pass object; api() sets Content-Type and stringifies for you
    });

    // reset & reload
    setItems([]);
    setCustomerId("");
    setDueDate("");
    setNotes("");
    setShowCreateModal(false);
    await load();
  } catch (e: any) {
    console.error("Failed to create invoice", e);
    alert(e?.message || "Failed to create invoice. Please try again.");
  }
};


  // also update markPaid to pass an object
const markPaid = async (inv: Invoice) => {
  try {
    await api(`/invoices/${inv.id}/status`, {
      method: "PUT",
      body: { status: "PAID", paidAmount: numOr0(inv.total) }, // <-- object, not string
    });
    await load();
  } catch (e) {
    console.error("Failed to mark paid", e);
    alert("Failed to mark invoice paid.");
  }
};


  /********** Filters & sorting **********/
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = [...invoices];

    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);

    if (term) {
      list = list.filter(
        (o) =>
          toStr(o.invoiceNumber).toLowerCase().includes(term) ||
          toStr(o.customer?.name).toLowerCase().includes(term) ||
          toStr(o.items?.map((i) => i.name).join(", ")).toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      let aV: any;
      let bV: any;
      switch (sortBy) {
        case "createdAt":
          aV = new Date(a.createdAt || 0).getTime();
          bV = new Date(b.createdAt || 0).getTime();
          break;
        case "invoiceNumber":
          aV = toStr(a.invoiceNumber).toLowerCase();
          bV = toStr(b.invoiceNumber).toLowerCase();
          break;
        case "total":
          aV = numOr0(a.total);
          bV = numOr0(b.total);
          break;
        case "status":
          aV = toStr(a.status);
          bV = toStr(b.status);
          break;
        default:
          aV = new Date(a.createdAt || 0).getTime();
          bV = new Date(b.createdAt || 0).getTime();
      }
      if (sortOrder === "asc") return aV > bV ? 1 : -1;
      return aV < bV ? 1 : -1;
    });

    return list;
  }, [invoices, searchTerm, statusFilter, sortBy, sortOrder]);

  if (loading) return <InvoicesSkeleton />;
  if (error)
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 text-center">
        <p className="text-lg font-semibold mb-2">Unable to load invoices</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={handleRefresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Try Again</button>
      </motion.div>
    );

  return (
    <div className="space-y-6 fade-in max-w-8xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Invoices</h1>
          <p className="text-muted-foreground">Issue, track, and export customer invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <RefreshCw className={clsx("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
          <motion.button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Plus className="h-4 w-4" /> New Invoice
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search invoice #, customer or item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="createdAt">Sort by Date</option>
            <option value="invoiceNumber">Sort by Invoice #</option>
            <option value="total">Sort by Total</option>
            <option value="status">Sort by Status</option>
          </select>
          <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors">
            {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />} {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
      </motion.div>

      {/* Invoices Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">#</th>
                <th className="text-left p-4 font-medium">Customer</th>
                <th className="text-left p-4 font-medium">Total</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Due</th>
                <th className="text-left p-4 font-medium">PDF</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filtered ?? []).map((inv, index) => (
                <motion.tr key={inv.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="border-b border-border hover:bg-accent/20 transition-colors">
                  <td className="p-4 font-mono text-sm">{toStr(inv.invoiceNumber, "-")}</td>
                  <td className="p-4">{toStr(inv.customer?.name, "-")}</td>
                  <td className="p-4 font-medium">{formatPKR(numOr0(inv.total))}</td>
                  <td className="p-4"><StatusBadge status={inv.status} /></td>
                  <td className="p-4 text-sm text-muted-foreground">{dateLabel(inv.dueDate)}</td>
                  {/* <td className="p-4 text-sm">
                    <button
                      onClick={() => openPdf(inv.id)}
                      className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-accent"
                      title="Open PDF"
                    >
                      <FileText className="h-4 w-4" />
                      Open
                    </button>
                  </td> */}

                  <td className="p-4 text-sm">
                    <button
                      className="text-blue-600 underline"
                      onClick={() => openPdf(inv.id)}
                    >
                      {inv.pdfUrl ? 'Open PDF' : 'Generate PDF'}
                    </button>
                  </td>

                  <td className="p-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openPdf(inv.id)}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-accent"
                        title="Print / Open PDF"
                      >
                        <FileText className="h-4 w-4" /> Print
                      </button>

                      {inv.status !== "PAID" && (
                        <button
                          onClick={() => markPaid(inv)}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateInvoiceModal
            customers={customers}
            customerId={customerId}
            setCustomerId={setCustomerId}
            items={items}
            addBlankItem={addBlankItem}
            updateItem={updateItem}
            removeItem={removeItem}
            subtotal={invoiceSubtotal}
            dueDate={dueDate}
            setDueDate={setDueDate}
            notes={notes}
            setNotes={setNotes}
            onSubmit={create}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/********************* Status Badge *********************/
function StatusBadge({ status }: { status: Invoice["status"] }) {
  const map: Record<Invoice["status"], string> = {
    PENDING: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    PAID: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return (
    <span className={clsx("px-2 py-1 text-xs font-medium rounded-full", map[status])}>
      {status}
    </span>
  );
}

/********************* Create Invoice Modal *********************/
function CreateInvoiceModal({
  customers,
  customerId,
  setCustomerId,
  items,
  addBlankItem,
  updateItem,
  removeItem,
  subtotal,
  dueDate,
  setDueDate,
  notes,
  setNotes,
  onSubmit,
  onClose,
}: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-3xl card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">New Invoice</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">Select Customer</option>
            {(customers ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{toStr(c.name, "Unnamed")}</option>
            ))}
          </select>

          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>

        {/* Items builder */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Items</h3>
            <button onClick={addBlankItem} className="px-3 py-1 rounded-lg bg-secondary hover:bg-secondary/80">Add Line</button>
          </div>

          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items yet. Click "Add Line" to start.</div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Qty</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-left p-3">Line Total</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: InvoiceItem, idx: number) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-2">
                        <input value={toStr(it.name)} onChange={(e) => updateItem(idx, { name: e.target.value })} className="w-full px-2 py-1 border border-border rounded-md bg-background" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={1} value={it.qty} onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value)) })} className="w-24 px-2 py-1 border border-border rounded-md bg-background" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={0} value={it.price} onChange={(e) => updateItem(idx, { price: Math.max(0, Number(e.target.value)) })} className="w-32 px-2 py-1 border border-border rounded-md bg-background" />
                      </td>
                      <td className="p-2 font-medium">{formatPKR(numOr0(it.qty) * numOr0(it.price))}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => removeItem(idx)} className="px-3 py-1 text-sm rounded-lg hover:bg-destructive/10 text-destructive">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Optional: payment instructions or additional info" />
            </div>
            <div className="flex flex-col justify-end">
              <div className="flex items-center justify-between text-lg">
                <span>Subtotal</span>
                <span className="font-semibold">{formatPKR(subtotal)}</span>
              </div>
              {/* Reserve space for tax/discount if you add later */}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onSubmit} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Create Invoice</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/********************* Skeleton *********************/
function InvoicesSkeleton() {
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
