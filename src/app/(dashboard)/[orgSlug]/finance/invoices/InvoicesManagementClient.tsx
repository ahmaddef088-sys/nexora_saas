'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role, InvoiceStatus } from '@prisma/client';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Eye,
  Lock,
  Building,
  Ban,
  Clock,
  Send,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Package,
  RefreshCw,
  AlertTriangle,
  Check,
  DollarSign,
  Filter,
  Calendar,
} from 'lucide-react';
import {
  createInvoiceAction,
  updateInvoiceAction,
  issueInvoiceAction,
  voidInvoiceAction,
  generateInvoiceFromOrderAction,
} from '@/lib/actions/invoices';
import {
  canCreateInvoice,
  canEditInvoice,
  canIssueInvoice,
  canVoidInvoice,
  canGenerateInvoiceFromOrder,
} from '@/lib/auth/finance-auth';

// ─── Data shapes passed from the server page ─────────────────────────────────

export interface SerializedInvoiceItem {
  id: string;
  productId: string | null;
  productName: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerCompany: string | null;
  orderId: string | null;
  orderRef: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discount: string;
  total: string;
  paidAmount: string;
  balance: string;
  notes: string | null;
  terms: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  paymentsCount: number;
  items: SerializedInvoiceItem[];
}

export interface CustomerOption {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: string;
}

export interface EligibleOrder {
  id: string;
  orderRef: string;
  customerName: string;
  total: string;
  status: string;
  hasInvoice: boolean;
}

// ─── Line item draft ──────────────────────────────────────────────────────────

interface LineItemDraft {
  uid: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

function newLineItem(products: ProductOption[]): LineItemDraft {
  const defaultProduct = products[0];
  return {
    uid: `li_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productId: defaultProduct ? defaultProduct.id : '',
    description: defaultProduct
      ? `${defaultProduct.name}${defaultProduct.sku ? ` (${defaultProduct.sku})` : ''}`
      : '',
    quantity: 1,
    unitPrice: defaultProduct ? defaultProduct.price : '0.00',
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoicesManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  invoices: SerializedInvoice[];
  customers: CustomerOption[];
  products: ProductOption[];
  eligibleOrders: EligibleOrder[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

// ─── Status badge helper ──────────────────────────────────────────────────────

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; cls: string; icon: React.ElementType }> = {
    DRAFT:         { label: 'Draft',         cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20',     icon: Clock },
    ISSUED:        { label: 'Issued',         cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       icon: Send },
    PARTIALLY_PAID:{ label: 'Part. Paid',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',     icon: DollarSign },
    OVERDUE:       { label: 'Overdue',       cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',        icon: AlertTriangle },
    PAID:          { label: 'Paid',          cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    VOIDED:        { label: 'Voided',        cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',        icon: Ban },
  };
  const cfg = map[status] || map.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Client preview totals (display only — server recalculates authoritatively) ─

function previewTotals(items: LineItemDraft[], taxRateStr: string, discountStr: string) {
  const subtotal = items.reduce((acc, li) => {
    const qty = Math.max(1, parseInt(String(li.quantity), 10) || 1);
    const price = parseFloat(li.unitPrice) || 0;
    return acc + qty * price;
  }, 0);
  const discount = Math.max(0, parseFloat(discountStr) || 0);
  const appliedDiscount = Math.min(discount, subtotal);
  const taxable = Math.max(0, subtotal - appliedDiscount);
  const taxRate = Math.max(0, Math.min(100, parseFloat(taxRateStr) || 0));
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = taxable + taxAmount;
  return { subtotal, appliedDiscount, taxAmount, total };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InvoicesManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  invoices,
  customers,
  products,
  eligibleOrders,
}: InvoicesManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Permissions ──────────────────────────────────────────────────────────────
  const canCreate = canCreateInvoice(currentUserRole).allowed;
  const canIssue = canIssueInvoice(currentUserRole).allowed;
  const canVoid = canVoidInvoice(currentUserRole).allowed;

  // ── Search / filter / page ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // ── Feedback ─────────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Modal states ──────────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SerializedInvoice | null>(null);
  const [issuingInvoiceId, setIssuingInvoiceId] = useState<string | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState<SerializedInvoice | null>(null);
  const [isGenFromOrderOpen, setIsGenFromOrderOpen] = useState(false);

  // ── Create / Edit form state ──────────────────────────────────────────────────
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('0');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [formLineItems, setFormLineItems] = useState<LineItemDraft[]>([newLineItem(products)]);

  // ── Void form state ───────────────────────────────────────────────────────────
  const [voidReason, setVoidReason] = useState('');

  // ── Gen from order state ──────────────────────────────────────────────────────
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [genDueDate, setGenDueDate] = useState('');
  const [genTaxRate, setGenTaxRate] = useState('0');
  const [genNotes, setGenNotes] = useState('');
  const [genTerms, setGenTerms] = useState('');

  // ── Filtered + paginated invoices ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter((inv) => {
      const matchSearch =
        q === '' ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerCompany?.toLowerCase().includes(q) ?? false) ||
        (inv.orderRef?.toLowerCase().includes(q) ?? false);
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePageNum = Math.min(page, totalPages);
  const paged = filtered.slice((safePageNum - 1) * PAGE_SIZE, safePageNum * PAGE_SIZE);

  // ── Metrics ───────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => ({
    total: invoices.length,
    draft: invoices.filter(i => i.status === InvoiceStatus.DRAFT).length,
    issued: invoices.filter(i => i.status === InvoiceStatus.ISSUED).length,
    overdue: invoices.filter(i => i.status === InvoiceStatus.OVERDUE).length,
    paid: invoices.filter(i => i.status === InvoiceStatus.PAID).length,
    partiallyPaid: invoices.filter(i => i.status === InvoiceStatus.PARTIALLY_PAID).length,
    totalRevenue: invoices
      .filter(i => i.status === InvoiceStatus.PAID)
      .reduce((acc, i) => acc + parseFloat(i.total), 0),
    outstandingAR: invoices
      .filter(i => ([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] as InvoiceStatus[]).includes(i.status))
      .reduce((acc, i) => acc + parseFloat(i.balance), 0),
  }), [invoices]);

  // ── Form helpers ──────────────────────────────────────────────────────────────
  const productMap = new Map(products.map(p => [p.id, p]));

  const resetCreateForm = () => {
    setFormCustomerId('');
    const d = new Date(); d.setDate(d.getDate() + 30);
    setFormDueDate(d.toISOString().split('T')[0]);
    setFormTaxRate('0');
    setFormDiscount('0');
    setFormNotes('');
    setFormTerms('');
    setFormLineItems([newLineItem(products)]);
  };

  const openCreateModal = () => {
    resetCreateForm();
    setFeedback(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (inv: SerializedInvoice) => {
    setFormCustomerId(inv.customerId);
    setFormDueDate(inv.dueDate.split('T')[0]);
    setFormTaxRate(parseFloat(inv.taxRate).toString());
    setFormDiscount(parseFloat(inv.discount).toString());
    setFormNotes(inv.notes || '');
    setFormTerms(inv.terms || '');
    setFormLineItems(inv.items.map(item => ({
      uid: item.id,
      productId: item.productId || '',
      description: item.description,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice).toFixed(2),
    })));
    setEditingInvoice(inv);
    setFeedback(null);
  };

  // ── Line item handlers ────────────────────────────────────────────────────────
  const addLineItem = () =>
    setFormLineItems(prev => [...prev, newLineItem(products)]);

  const removeLineItem = (uid: string) =>
    setFormLineItems(prev => prev.length > 1 ? prev.filter(li => li.uid !== uid) : prev);

  const updateLineItem = (uid: string, field: keyof Omit<LineItemDraft, 'uid'>, value: string | number) => {
    setFormLineItems(prev => prev.map(li => {
      if (li.uid !== uid) return li;
      if (field === 'productId') {
        const prod = productMap.get(value as string);
        if (prod) {
          const isDescAuto = li.description.trim() === '' || products.some(p =>
            li.description === p.name ||
            li.description === `${p.name} (${p.sku})` ||
            li.description === `${p.name} (SKU: ${p.sku})`
          );
          return {
            ...li,
            productId: prod.id,
            description: isDescAuto ? `${prod.name}${prod.sku ? ` (${prod.sku})` : ''}` : li.description,
            unitPrice: prod.price,
          };
        } else {
          return {
            ...li,
            productId: '',
          };
        }
      }
      return { ...li, [field]: value };
    }));
  };

  // ── Client-side preview totals ────────────────────────────────────────────────
  const preview = previewTotals(formLineItems, formTaxRate, formDiscount);

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVER ACTION HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!formCustomerId) { setFeedback({ type: 'error', message: 'Please select a customer.' }); return; }
    if (formLineItems.length === 0) { setFeedback({ type: 'error', message: 'Add at least one line item.' }); return; }
    const emptyDesc = formLineItems.some(li => !li.description || li.description.trim() === '');
    if (emptyDesc) { setFeedback({ type: 'error', message: 'Please enter a description for all line items.' }); return; }

    startTransition(async () => {
      const res = await createInvoiceAction(orgSlug, {
        customerId: formCustomerId,
        dueDate: new Date(formDueDate),
        taxRate: parseFloat(formTaxRate) || 0,
        discount: parseFloat(formDiscount) || 0,
        notes: formNotes.trim() || undefined,
        terms: formTerms.trim() || undefined,
        items: formLineItems.map(li => ({
          productId: li.productId || undefined,
          description: li.description.trim(),
          quantity: parseInt(String(li.quantity), 10) || 1,
          unitPrice: parseFloat(li.unitPrice) || 0,
        })),
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice created.' });
        setIsCreateOpen(false);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create invoice.' });
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    setFeedback(null);
    if (!formCustomerId) { setFeedback({ type: 'error', message: 'Please select a customer.' }); return; }
    if (formLineItems.length === 0) { setFeedback({ type: 'error', message: 'Add at least one line item.' }); return; }
    const emptyDesc = formLineItems.some(li => !li.description || li.description.trim() === '');
    if (emptyDesc) { setFeedback({ type: 'error', message: 'Please enter a description for all line items.' }); return; }

    startTransition(async () => {
      const res = await updateInvoiceAction(orgSlug, {
        invoiceId: editingInvoice.id,
        customerId: formCustomerId,
        dueDate: new Date(formDueDate),
        taxRate: parseFloat(formTaxRate) || 0,
        discount: parseFloat(formDiscount) || 0,
        notes: formNotes.trim() || undefined,
        terms: formTerms.trim() || undefined,
        items: formLineItems.map(li => ({
          productId: li.productId || undefined,
          description: li.description.trim(),
          quantity: parseInt(String(li.quantity), 10) || 1,
          unitPrice: parseFloat(li.unitPrice) || 0,
        })),
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice updated.' });
        setEditingInvoice(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update invoice.' });
      }
    });
  };

  const handleIssue = async () => {
    if (!issuingInvoiceId) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await issueInvoiceAction(orgSlug, { invoiceId: issuingInvoiceId });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice issued.' });
        setIssuingInvoiceId(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to issue invoice.' });
        setIssuingInvoiceId(null);
      }
    });
  };

  const handleVoid = async () => {
    if (!voidingInvoice) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await voidInvoiceAction(orgSlug, {
        invoiceId: voidingInvoice.id,
        reason: voidReason.trim() || undefined,
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice voided.' });
        setVoidingInvoice(null);
        setVoidReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to void invoice.' });
        setVoidingInvoice(null);
      }
    });
  };

  const handleGenerateFromOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) { setFeedback({ type: 'error', message: 'Please select an eligible order.' }); return; }
    setFeedback(null);
    startTransition(async () => {
      const res = await generateInvoiceFromOrderAction(orgSlug, {
        orderId: selectedOrderId,
        dueDate: genDueDate ? new Date(genDueDate) : undefined,
        taxRate: parseFloat(genTaxRate) || 0,
        notes: genNotes.trim() || undefined,
        terms: genTerms.trim() || undefined,
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice generated from order.' });
        setIsGenFromOrderOpen(false);
        setSelectedOrderId('');
        setGenDueDate('');
        setGenTaxRate('0');
        setGenNotes('');
        setGenTerms('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to generate invoice.' });
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Feedback Banner ──────────────────────────────────────────────────── */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-lg border text-xs font-medium transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {feedback.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />
            }
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground ml-4">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoice Management</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {metrics.total} {metrics.total === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Create, issue, and track invoices for <strong className="text-foreground">{tenantName}</strong>. All financial calculations are server-authoritative.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Generate from Order */}
          {canCreate && eligibleOrders.some(o => !o.hasInvoice) && (
            <button
              id="gen-from-order-btn"
              type="button"
              onClick={() => { setIsGenFromOrderOpen(true); setFeedback(null); }}
              className="inline-flex items-center space-x-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              <span>Generate from Order</span>
            </button>
          )}

          {/* Create Invoice */}
          {canCreate ? (
            <button
              id="create-invoice-btn"
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Invoice</span>
            </button>
          ) : (
            <div
              title="Only OWNER, ADMIN, or MEMBER can create invoices"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Create Invoice (Restricted)</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Metrics Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: metrics.total, sub: 'All invoices', cls: 'text-foreground' },
          { label: 'Draft', value: metrics.draft, sub: 'Pending issuance', cls: 'text-slate-400' },
          { label: 'Issued', value: metrics.issued, sub: 'Awaiting payment', cls: 'text-blue-400' },
          { label: 'Part. Paid', value: metrics.partiallyPaid, sub: 'Partially settled', cls: 'text-amber-400' },
          { label: 'Overdue', value: metrics.overdue, sub: 'Past due date', cls: 'text-rose-400' },
          { label: 'Paid', value: metrics.paid, sub: 'Fully settled', cls: 'text-emerald-400' },
          { label: 'Outstanding AR', value: `$${metrics.outstandingAR.toFixed(2)}`, sub: 'Total uncollected', cls: 'text-amber-400' },
        ].map(m => (
          <div key={m.label} className="rounded-lg border border-border bg-card p-3.5 space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</div>
            <div className={`text-xl font-bold ${m.cls}`}>{m.value}</div>
            <div className="text-[10px] text-muted-foreground">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="invoice-search"
            type="text"
            placeholder="Search by number, customer, order..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value={InvoiceStatus.DRAFT}>Draft</option>
            <option value={InvoiceStatus.ISSUED}>Issued</option>
            <option value={InvoiceStatus.PARTIALLY_PAID}>Partially Paid</option>
            <option value={InvoiceStatus.OVERDUE}>Overdue</option>
            <option value={InvoiceStatus.PAID}>Paid</option>
            <option value={InvoiceStatus.VOIDED}>Voided</option>
          </select>
        </div>
      </div>

      {/* ── Invoices Table ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Linked Order</th>
                <th className="px-4 py-3">Issue / Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <FileText className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-xs">
                        {searchQuery || statusFilter !== 'ALL' ? 'No invoices match your filters.' : 'No invoices yet.'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/75 max-w-xs">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try adjusting your search or status filter.'
                          : 'Create your first invoice to start tracking payments and receivables.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((inv) => {
                  const isDraft = inv.status === InvoiceStatus.DRAFT;
                  const canEditThis = canEditInvoice(currentUserRole, inv.status).allowed;
                  const balance = parseFloat(inv.balance);
                  const isOverdue = inv.status === InvoiceStatus.OVERDUE;

                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      {/* Invoice Number */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/${orgSlug}/finance/invoices/${inv.id}`}
                          className="font-mono font-bold text-primary hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {inv.createdAt.split('T')[0]}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{inv.customerName}</div>
                        {inv.customerCompany && (
                          <div className="text-[11px] text-muted-foreground flex items-center space-x-1">
                            <Building className="h-3 w-3 shrink-0" />
                            <span>{inv.customerCompany}</span>
                          </div>
                        )}
                      </td>

                      {/* Linked Order */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {inv.orderId && inv.orderRef ? (
                          <Link
                            href={`/${orgSlug}/orders/${inv.orderId}`}
                            className="font-mono text-[11px] text-primary/80 hover:text-primary hover:underline flex items-center gap-1"
                          >
                            <ArrowRight className="h-3 w-3" />
                            {inv.orderRef}
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/50 italic">—</span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-foreground">{inv.issueDate.split('T')[0]}</div>
                        <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-rose-400 font-medium' : 'text-muted-foreground'}`}>
                          <Calendar className="h-3 w-3 shrink-0" />
                          Due {inv.dueDate.split('T')[0]}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-bold text-foreground">
                        ${parseFloat(inv.total).toFixed(2)}
                      </td>

                      {/* Paid */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={parseFloat(inv.paidAmount) > 0 ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                          ${parseFloat(inv.paidAmount).toFixed(2)}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={balance > 0 ? (isOverdue ? 'text-rose-400 font-semibold' : 'text-amber-400 font-semibold') : 'text-muted-foreground'}>
                          ${balance.toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          {/* View Details */}
                          <Link
                            href={`/${orgSlug}/finance/invoices/${inv.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="View Invoice Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {/* Edit (DRAFT only) */}
                          {canEditThis && (
                            <button
                              type="button"
                              onClick={() => openEditModal(inv)}
                              disabled={isPending}
                              title="Edit Draft Invoice"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {/* Issue (DRAFT only) */}
                          {isDraft && canIssue && (
                            <button
                              type="button"
                              onClick={() => { setIssuingInvoiceId(inv.id); setFeedback(null); }}
                              disabled={isPending}
                              title="Issue Invoice"
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                            >
                              <Send className="h-3 w-3" />
                              <span>Issue</span>
                            </button>
                          )}

                          {/* Void */}
                          {([InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE] as InvoiceStatus[]).includes(inv.status) && canVoid && (
                            <button
                              type="button"
                              onClick={() => { setVoidingInvoice(inv); setVoidReason(''); setFeedback(null); }}
                              disabled={isPending}
                              title="Void Invoice"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {(safePageNum - 1) * PAGE_SIZE + 1}–{Math.min(safePageNum * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePageNum <= 1}
                className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-medium text-foreground">{safePageNum} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePageNum >= totalPages}
                className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: CREATE / EDIT INVOICE
         ═══════════════════════════════════════════════════════════════════════ */}
      {(isCreateOpen || editingInvoice) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {editingInvoice ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editingInvoice ? `Edit Draft — ${editingInvoice.invoiceNumber}` : 'Create Invoice (Draft)'}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {editingInvoice ? 'Only DRAFT invoices can be edited.' : 'Invoice will be saved as DRAFT. Issue it to lock the snapshot.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreateOpen(false); setEditingInvoice(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingInvoice ? handleUpdate : handleCreate} className="space-y-5">
              {/* Customer + Due Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={formCustomerId}
                    onChange={e => setFormCustomerId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">— Select Customer —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.companyName ? ` (${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Due Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Tax Rate + Discount Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formTaxRate}
                    onChange={e => setFormTaxRate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Discount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formDiscount}
                    onChange={e => setFormDiscount(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Line Items <span className="text-destructive">*</span>
                  </div>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center space-x-1 text-xs text-primary hover:underline font-medium cursor-pointer px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Column Headers */}
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    <div className="col-span-4">Description</div>
                    <div className="col-span-3">Product (Optional)</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-1"></div>
                  </div>

                  {formLineItems.map((li, idx) => {
                    const linePreviewTotal = (parseFloat(li.unitPrice) || 0) * (parseInt(String(li.quantity), 10) || 1);
                    return (
                      <div key={li.uid} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border bg-muted/20 p-2">
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Enter item description..."
                            value={li.description}
                            onChange={e => updateLineItem(li.uid, 'description', e.target.value)}
                            maxLength={250}
                            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={li.productId}
                            onChange={e => updateLineItem(li.uid, 'productId', e.target.value)}
                            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">No product (custom)</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            required
                            min="1"
                            step="1"
                            value={li.quantity}
                            onChange={e => updateLineItem(li.uid, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={li.unitPrice}
                            onChange={e => updateLineItem(li.uid, 'unitPrice', e.target.value)}
                            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-end space-x-1">
                          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                            ${linePreviewTotal.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLineItem(li.uid)}
                            disabled={formLineItems.length <= 1}
                            className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Client-side Preview (display only) */}
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-1.5 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Preview (display only — server recalculates authoritatively)
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">${preview.subtotal.toFixed(2)}</span>
                </div>
                {preview.appliedDiscount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount</span>
                    <span className="font-mono">−${preview.appliedDiscount.toFixed(2)}</span>
                  </div>
                )}
                {preview.taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({formTaxRate}%)</span>
                    <span className="font-mono">${preview.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-foreground border-t border-border pt-1.5 mt-1">
                  <span>Estimated Total</span>
                  <span className="font-mono text-primary">${preview.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Notes + Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    maxLength={1000}
                    placeholder="Internal or customer-facing notes..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Terms (optional)</label>
                  <textarea
                    rows={3}
                    value={formTerms}
                    onChange={e => setFormTerms(e.target.value)}
                    maxLength={1000}
                    placeholder="Payment terms, late fee policy..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingInvoice(null); }}
                  className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center space-x-2 rounded-md bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{editingInvoice ? 'Save Changes' : 'Create Draft Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: ISSUE INVOICE CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      {issuingInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Issue Invoice</h2>
                <p className="text-xs text-muted-foreground">This will finalize and lock the invoice snapshot.</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Warning
              </div>
              <p>Once issued, line items and totals are permanently locked. The invoice can no longer be edited. The customer may then receive a payment request.</p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setIssuingInvoiceId(null)}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleIssue}
                disabled={isPending}
                className="inline-flex items-center space-x-2 rounded-md bg-blue-600 px-5 py-2 text-xs font-medium text-white shadow hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Confirm — Issue Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: VOID INVOICE CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      {voidingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Void Invoice</h2>
                <p className="text-xs text-muted-foreground">
                  Invoice <span className="font-mono text-foreground">{voidingInvoice.invoiceNumber}</span>
                </p>
              </div>
            </div>

            {parseFloat(voidingInvoice.paidAmount) > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Cannot Void
                </div>
                <p>This invoice has ${parseFloat(voidingInvoice.paidAmount).toFixed(2)} in recorded payments. Refund all payments before voiding.</p>
              </div>
            )}

            {parseFloat(voidingInvoice.paidAmount) === 0 && (
              <>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                  Voiding will permanently cancel this invoice. The record is preserved in the system for audit purposes.
                  No ledger entry will be created since no payment has been received.
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Void Reason (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    maxLength={250}
                    placeholder="Enter reason for voiding..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-destructive placeholder:text-muted-foreground"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => { setVoidingInvoice(null); setVoidReason(''); }}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              {parseFloat(voidingInvoice.paidAmount) === 0 && (
                <button
                  onClick={handleVoid}
                  disabled={isPending}
                  className="inline-flex items-center space-x-2 rounded-md bg-destructive px-5 py-2 text-xs font-medium text-destructive-foreground shadow hover:bg-destructive/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  <span>Void Invoice</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: GENERATE FROM ORDER
         ═══════════════════════════════════════════════════════════════════════ */}
      {isGenFromOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Generate Invoice from Order</h2>
                  <p className="text-[11px] text-muted-foreground">Only CONFIRMED or COMPLETED orders without an existing invoice are eligible.</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsGenFromOrderOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateFromOrder} className="space-y-4">
              {/* Order select */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Order <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={selectedOrderId}
                  onChange={e => setSelectedOrderId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Select eligible order —</option>
                  {eligibleOrders.filter(o => !o.hasInvoice).map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderRef} — {o.customerName} (${parseFloat(o.total).toFixed(2)}) [{o.status}]
                    </option>
                  ))}
                </select>
                {eligibleOrders.filter(o => !o.hasInvoice).length === 0 && (
                  <p className="text-[11px] text-amber-400 flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    No eligible orders without invoices at this time.
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Due Date (optional, defaults to +30 days)
                  </label>
                  <input
                    type="date"
                    value={genDueDate}
                    onChange={e => setGenDueDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={genTaxRate}
                    onChange={e => setGenTaxRate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Historical snapshot notice */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-primary/80">
                <strong className="text-primary">Historical Snapshot:</strong> Order line items are snapshotted at this moment. Future changes to product prices will not affect the invoice.
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={genNotes}
                  onChange={e => setGenNotes(e.target.value)}
                  maxLength={1000}
                  placeholder="Notes for the generated invoice..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Terms */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Terms (optional)</label>
                <textarea
                  rows={2}
                  value={genTerms}
                  onChange={e => setGenTerms(e.target.value)}
                  maxLength={1000}
                  placeholder="Payment terms..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsGenFromOrderOpen(false)}
                  className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || eligibleOrders.filter(o => !o.hasInvoice).length === 0}
                  className="inline-flex items-center space-x-2 rounded-md bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span>Generate Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
