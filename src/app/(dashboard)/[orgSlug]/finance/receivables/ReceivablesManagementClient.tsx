'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Role, InvoiceStatus } from '@prisma/client';
import {
  DollarSign,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Clock,
  Building,
  User,
  Eye,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  AlertTriangle,
  Users,
  ShieldCheck,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  AgingBucket,
  agingBucketLabels,
  agingBucketBadges,
} from '@/lib/utils/receivables-constants';

// ─── Data Types ───────────────────────────────────────────────────────────────

export interface SerializedReceivableInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customerId: string;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  total: string;
  paidAmount: string;
  balance: string;
  daysPastDue: number;
  agingBucket: AgingBucket;
}

export interface CustomerARSummary {
  customerId: string;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  invoiceCount: number;
  totalOutstanding: string;
  oldestDueDate: string;
  oldestAgingBucket: AgingBucket;
}

export interface ReceivablesServerTotals {
  totalAR: string;
  currentAR: string;
  overdueAR: string;
  bucket1_30: string;
  bucket31_60: string;
  bucket61_90: string;
  bucketOver90: string;
  totalInvoicesCount: number;
  overdueInvoicesCount: number;
  affectedCustomersCount: number;
}

interface ReceivablesManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  invoices: SerializedReceivableInvoice[];
  customerSummaries: CustomerARSummary[];
  serverTotals: ReceivablesServerTotals;
}

const PAGE_SIZE = 15;

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case InvoiceStatus.ISSUED:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/20">
          Issued
        </span>
      );
    case InvoiceStatus.PARTIALLY_PAID:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/20">
          Partially Paid
        </span>
      );
    case InvoiceStatus.OVERDUE:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-rose-500/10 text-rose-400 border-rose-500/20">
          Overdue
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-muted text-muted-foreground border-border">
          {status}
        </span>
      );
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReceivablesManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  invoices,
  customerSummaries,
  serverTotals,
}: ReceivablesManagementClientProps) {
  // ── Views & Filters State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // ── Filter Invoices ────────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter((inv) => {
      // Search text match
      const matchesSearch =
        q === '' ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerCompany?.toLowerCase().includes(q) ?? false) ||
        (inv.customerEmail?.toLowerCase().includes(q) ?? false);

      // Aging bucket match
      let matchesBucket = true;
      if (bucketFilter === 'OVERDUE_ALL') {
        matchesBucket = inv.agingBucket !== 'CURRENT';
      } else if (bucketFilter !== 'ALL') {
        matchesBucket = inv.agingBucket === bucketFilter;
      }

      // Status match
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;

      return matchesSearch && matchesBucket && matchesStatus;
    });
  }, [invoices, searchQuery, bucketFilter, statusFilter]);

  // ── Filter Customers ───────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customerSummaries.filter((c) => {
      return (
        q === '' ||
        c.customerName.toLowerCase().includes(q) ||
        (c.customerCompany?.toLowerCase().includes(q) ?? false) ||
        (c.customerEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [customerSummaries, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const safePageNum = Math.min(page, totalPages);
  const pagedInvoices = filteredInvoices.slice(
    (safePageNum - 1) * PAGE_SIZE,
    safePageNum * PAGE_SIZE
  );

  const numTotalAR = parseFloat(serverTotals.totalAR);
  const numCurrent = parseFloat(serverTotals.currentAR);
  const numOverdue = parseFloat(serverTotals.overdueAR);
  const num1_30 = parseFloat(serverTotals.bucket1_30);
  const num31_60 = parseFloat(serverTotals.bucket31_60);
  const num61_90 = parseFloat(serverTotals.bucket61_90);
  const numOver90 = parseFloat(serverTotals.bucketOver90);

  // Percentages for aging bar
  const pCurrent = numTotalAR > 0 ? (numCurrent / numTotalAR) * 100 : 0;
  const p1_30 = numTotalAR > 0 ? (num1_30 / numTotalAR) * 100 : 0;
  const p31_60 = numTotalAR > 0 ? (num31_60 / numTotalAR) * 100 : 0;
  const p61_90 = numTotalAR > 0 ? (num61_90 / numTotalAR) * 100 : 0;
  const pOver90 = numTotalAR > 0 ? (numOver90 / numTotalAR) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Accounts Receivable</h1>
            <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 font-mono">
              ${numTotalAR.toFixed(2)} Total Outstanding
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aging schedule, overdue balances, and debt collection monitoring for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${orgSlug}/finance/invoices`}
            className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Manage Invoices</span>
          </Link>
          <Link
            href={`/${orgSlug}/finance/payments`}
            className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Record Payment</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total AR */}
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1 col-span-2 sm:col-span-2 lg:col-span-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total AR</div>
          <div className="text-xl font-bold font-mono text-foreground">${numTotalAR.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{serverTotals.totalInvoicesCount} invoices ({serverTotals.affectedCustomersCount} customers)</div>
        </div>

        {/* Current / Not Due */}
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Current (Not Due)</div>
          <div className="text-xl font-bold font-mono text-emerald-400">${numCurrent.toFixed(2)}</div>
          <div className="text-[10px] text-emerald-400/80">{pCurrent.toFixed(1)}% of AR</div>
        </div>

        {/* Overdue Total */}
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Total Overdue</div>
          <div className="text-xl font-bold font-mono text-rose-400">${numOverdue.toFixed(2)}</div>
          <div className="text-[10px] text-rose-400/80">{serverTotals.overdueInvoicesCount} past-due invoices</div>
        </div>

        {/* 1-30 Days */}
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">1–30 Days</div>
          <div className="text-xl font-bold font-mono text-amber-400">${num1_30.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{p1_30.toFixed(1)}% share</div>
        </div>

        {/* 31-60 Days */}
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">31–60 Days</div>
          <div className="text-xl font-bold font-mono text-orange-400">${num31_60.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{p31_60.toFixed(1)}% share</div>
        </div>

        {/* 61-90 Days */}
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">61–90 Days</div>
          <div className="text-xl font-bold font-mono text-rose-400">${num61_90.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{p61_90.toFixed(1)}% share</div>
        </div>

        {/* 90+ Days */}
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">90+ Days</div>
          <div className="text-xl font-bold font-mono text-red-500">${numOver90.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{pOver90.toFixed(1)}% share</div>
        </div>
      </div>

      {/* Visual Aging Distribution Bar */}
      {numTotalAR > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Receivables Aging Distribution</span>
            <span className="text-muted-foreground font-mono text-[11px]">${numTotalAR.toFixed(2)} Total</span>
          </div>

          <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden flex">
            {pCurrent > 0 && (
              <div
                style={{ width: `${pCurrent}%` }}
                className="bg-emerald-500 transition-all"
                title={`Current: $${numCurrent.toFixed(2)} (${pCurrent.toFixed(1)}%)`}
              />
            )}
            {p1_30 > 0 && (
              <div
                style={{ width: `${p1_30}%` }}
                className="bg-amber-500 transition-all"
                title={`1-30 Days: $${num1_30.toFixed(2)} (${p1_30.toFixed(1)}%)`}
              />
            )}
            {p31_60 > 0 && (
              <div
                style={{ width: `${p31_60}%` }}
                className="bg-orange-500 transition-all"
                title={`31-60 Days: $${num31_60.toFixed(2)} (${p31_60.toFixed(1)}%)`}
              />
            )}
            {p61_90 > 0 && (
              <div
                style={{ width: `${p61_90}%` }}
                className="bg-rose-500 transition-all"
                title={`61-90 Days: $${num61_90.toFixed(2)} (${p61_90.toFixed(1)}%)`}
              />
            )}
            {pOver90 > 0 && (
              <div
                style={{ width: `${pOver90}%` }}
                className="bg-red-600 transition-all"
                title={`90+ Days: $${numOver90.toFixed(2)} (${pOver90.toFixed(1)}%)`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Current: ${numCurrent.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>1–30d: ${num1_30.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span>31–60d: ${num31_60.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>61–90d: ${num61_90.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              <span>90+d: ${numOver90.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Tab Toggle */}
        <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Outstanding Invoices ({invoices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'customers'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Customer Balances ({customerSummaries.length})</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              id="ar-search"
              type="text"
              placeholder={
                activeTab === 'invoices'
                  ? 'Search invoice #, customer, email...'
                  : 'Search customer, company, email...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {activeTab === 'invoices' && (
            <>
              {/* Aging Bucket Filter */}
              <div className="flex items-center space-x-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <select
                  value={bucketFilter}
                  onChange={(e) => {
                    setBucketFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All Aging Buckets</option>
                  <option value="CURRENT">Current (Not Due)</option>
                  <option value="OVERDUE_ALL">All Overdue</option>
                  <option value="DAYS_1_30">1–30 Days Overdue</option>
                  <option value="DAYS_31_60">31–60 Days Overdue</option>
                  <option value="DAYS_61_90">61–90 Days Overdue</option>
                  <option value="DAYS_OVER_90">90+ Days Overdue</option>
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value={InvoiceStatus.ISSUED}>Issued</option>
                <option value={InvoiceStatus.PARTIALLY_PAID}>Partially Paid</option>
                <option value={InvoiceStatus.OVERDUE}>Overdue</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 1: OUTSTANDING INVOICES TABLE
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'invoices' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aging Bucket</th>
                  <th className="px-4 py-3 text-right">Invoice Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding Balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-foreground text-sm">
                          {searchQuery || bucketFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'No outstanding invoices match your filters.'
                            : 'No outstanding receivables.'}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {searchQuery || bucketFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'Try clearing your search query or selecting a different aging bucket.'
                            : 'All customer invoices are fully settled or no unpaid balances currently exist in this workspace.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedInvoices.map((inv) => {
                    const badge = agingBucketBadges[inv.agingBucket];

                    return (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        {/* Invoice # */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link
                            href={`/${orgSlug}/finance/invoices/${inv.id}`}
                            className="font-mono font-bold text-primary hover:underline"
                          >
                            {inv.invoiceNumber}
                          </Link>
                          {inv.orderId && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Linked Order
                            </div>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-foreground">{inv.customerName}</div>
                          {inv.customerCompany && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {inv.customerCompany}
                            </div>
                          )}
                        </td>

                        {/* Due Date & Days past due */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px]">
                          <div className="flex items-center gap-1 text-foreground">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {inv.dueDate.split('T')[0]}
                          </div>
                          <div
                            className={`text-[10px] mt-0.5 ${
                              inv.daysPastDue > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400'
                            }`}
                          >
                            {inv.daysPastDue === 0
                              ? 'Due on/after today'
                              : `${inv.daysPastDue} ${inv.daysPastDue === 1 ? 'day' : 'days'} overdue`}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>

                        {/* Aging Bucket */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono text-muted-foreground">
                          ${parseFloat(inv.total).toFixed(2)}
                        </td>

                        {/* Paid Amount */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono text-emerald-400">
                          ${parseFloat(inv.paidAmount).toFixed(2)}
                        </td>

                        {/* Outstanding Balance */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-amber-400 text-sm">
                          ${parseFloat(inv.balance).toFixed(2)}
                        </td>

                        {/* Action: View Invoice */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Link
                            href={`/${orgSlug}/finance/invoices/${inv.id}`}
                            className="inline-flex items-center space-x-1 p-1.5 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                            title="View Invoice Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(safePageNum - 1) * PAGE_SIZE + 1}–
                {Math.min(safePageNum * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePageNum <= 1}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 font-medium text-foreground">
                  {safePageNum} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePageNum >= totalPages}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 2: CUSTOMER BALANCES ROLLUP TABLE
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Unpaid Invoices</th>
                  <th className="px-4 py-3">Oldest Due Date</th>
                  <th className="px-4 py-3">Max Aging Risk</th>
                  <th className="px-4 py-3 text-right">Total Outstanding Balance</th>
                  <th className="px-4 py-3 text-right">Filter Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Users className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-foreground text-sm">
                          {searchQuery
                            ? 'No customer balances match your search.'
                            : 'No customer balances outstanding.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const badge = agingBucketBadges[c.oldestAgingBucket];

                    return (
                      <tr key={c.customerId} className="hover:bg-muted/20 transition-colors">
                        {/* Customer */}
                        <td className="px-4 py-3.5 font-bold text-foreground">
                          {c.customerName}
                        </td>

                        {/* Company */}
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {c.customerCompany || '—'}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5 text-muted-foreground font-mono text-[11px]">
                          {c.customerEmail || '—'}
                        </td>

                        {/* Invoice count */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border">
                            {c.invoiceCount} {c.invoiceCount === 1 ? 'invoice' : 'invoices'}
                          </span>
                        </td>

                        {/* Oldest due date */}
                        <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {c.oldestDueDate.split('T')[0]}
                        </td>

                        {/* Oldest Aging Bucket */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Total Outstanding Balance */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-amber-400 text-sm">
                          ${parseFloat(c.totalOutstanding).toFixed(2)}
                        </td>

                        {/* Filter Button */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(c.customerName);
                              setActiveTab('invoices');
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors border border-primary/20"
                          >
                            <span>View Invoices</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
