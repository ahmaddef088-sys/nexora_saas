'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { LedgerEntryType, Role } from '@prisma/client';
import {
  BookOpen,
  Search,
  Filter,
  Calendar,
  Lock,
  Eye,
  X,
  FileText,
  CreditCard,
  Receipt,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  Hash,
  User,
  Clock,
} from 'lucide-react';
import {
  ledgerReferenceTypeLabels,
  getLedgerEntryBadge,
} from '@/lib/utils/ledger-constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedLedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: string;
  entryDate: string;
  description: string;
  referenceType: string;
  referenceId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentId: string | null;
  paymentNumber: string | null;
  expenseId: string | null;
  expenseNumber: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface LedgerServerTotals {
  totalRevenue: string;
  totalExpenses: string;
  netCashFlow: string;
  totalEntries: number;
}

interface LedgerManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  entries: SerializedLedgerEntry[];
  serverTotals: LedgerServerTotals;
}

const PAGE_SIZE = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export function LedgerManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  entries,
  serverTotals,
}: LedgerManagementClientProps) {
  // ── Filters & Search ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // ── Read-Only Detail Inspector Modal ───────────────────────────────────────
  const [selectedEntry, setSelectedEntry] = useState<SerializedLedgerEntry | null>(null);

  // ── Filtered Entries ───────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return entries.filter((entry) => {
      const amountNum = parseFloat(entry.amount);
      const isNegative = amountNum < 0;

      // Type / Category match
      let matchesType = true;
      if (typeFilter === 'REVENUE') {
        matchesType = entry.type === LedgerEntryType.REVENUE && !isNegative;
      } else if (typeFilter === 'EXPENSE') {
        matchesType = entry.type === LedgerEntryType.EXPENSE && !isNegative;
      } else if (typeFilter === 'REFUND') {
        matchesType = entry.type === LedgerEntryType.REVENUE && isNegative;
      } else if (typeFilter === 'REVERSAL') {
        matchesType = entry.type === LedgerEntryType.EXPENSE && isNegative;
      }

      // Search match
      const matchesSearch =
        q === '' ||
        entry.description.toLowerCase().includes(q) ||
        entry.referenceType.toLowerCase().includes(q) ||
        (entry.referenceId?.toLowerCase().includes(q) ?? false) ||
        (entry.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
        (entry.paymentNumber?.toLowerCase().includes(q) ?? false) ||
        (entry.expenseNumber?.toLowerCase().includes(q) ?? false) ||
        (entry.createdByName?.toLowerCase().includes(q) ?? false) ||
        (entry.createdByEmail?.toLowerCase().includes(q) ?? false) ||
        entry.id.toLowerCase().includes(q);

      return matchesType && matchesSearch;
    });
  }, [entries, searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePageNum = Math.min(page, totalPages);
  const pagedEntries = filteredEntries.slice(
    (safePageNum - 1) * PAGE_SIZE,
    safePageNum * PAGE_SIZE
  );

  const numRevenue = parseFloat(serverTotals.totalRevenue);
  const numExpenses = parseFloat(serverTotals.totalExpenses);
  const numNet = parseFloat(serverTotals.netCashFlow);
  const isNetPositive = numNet >= 0;

  return (
    <div className="space-y-6">
      {/* Header & Immutability Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">General Ledger</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary font-mono">
              {serverTotals.totalEntries} Journal {serverTotals.totalEntries === 1 ? 'Entry' : 'Entries'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable, append-only double-entry financial audit journal for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center space-x-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
            <Lock className="h-3.5 w-3.5" />
            <span>Append-Only / Read-Only</span>
          </div>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-4 text-xs text-muted-foreground flex items-start space-x-3">
        <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">Accounting Immutability & Audit Guarantee</div>
          <p className="leading-relaxed">
            The General Ledger serves as the authoritative source of financial truth. All entries are created automatically by approved business operations (Invoices, Payments, Refunds, and Expenses). Ledger entries are permanent and cannot be modified or deleted. Financial corrections are recorded as offsetting balancing entries.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Recognized Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            ${numRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">Net cash inflows & receipts</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Expenses</span>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            ${numExpenses.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">Operational disbursements</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Net Cash Flow</span>
            <Scale className="h-4 w-4 text-primary" />
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              isNetPositive ? 'text-primary' : 'text-rose-400'
            }`}
          >
            {isNetPositive ? '+' : ''}${numNet.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">Operating margin (Rev − Exp)</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Audit Journal</span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {serverTotals.totalEntries}
          </div>
          <div className="text-[10px] text-muted-foreground">Total immutable entries</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="ledger-search"
            type="text"
            placeholder="Search by memo, reference, user, entity ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Entry Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Entries ({entries.length})</option>
            <option value="REVENUE">Revenue</option>
            <option value="EXPENSE">Expense</option>
            <option value="REFUND">Refunds (Reversal)</option>
            <option value="REVERSAL">Expense Corrections (Reversal)</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description / Memo</th>
                <th className="px-4 py-3">Reference / Entity</th>
                <th className="px-4 py-3">Recorded By</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-xs">
                        {searchQuery || typeFilter !== 'ALL'
                          ? 'No ledger records match your criteria.'
                          : 'No journal entries recorded in this workspace yet.'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/75 max-w-xs">
                        {searchQuery || typeFilter !== 'ALL'
                          ? 'Try adjusting your search query or reset the type filter.'
                          : 'Financial activities like Payments and Expenses will automatically create immutable journal entries here.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedEntries.map((entry) => {
                  const amountNum = parseFloat(entry.amount);
                  const isNegative = amountNum < 0;
                  const badge = getLedgerEntryBadge(
                    entry.type,
                    entry.referenceType,
                    amountNum
                  );

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      {/* Type Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate max-w-[120px]">
                          {entry.referenceType}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {entry.entryDate.split('T')[0]}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3.5 text-foreground font-medium max-w-sm">
                        <div className="truncate" title={entry.description}>
                          {entry.description}
                        </div>
                      </td>

                      {/* Reference Link */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px]" onClick={(e) => e.stopPropagation()}>
                        {entry.invoiceNumber && (
                          <Link
                            href={`/${orgSlug}/finance/invoices/${entry.invoiceId}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            <span>{entry.invoiceNumber}</span>
                          </Link>
                        )}
                        {entry.paymentNumber && (
                          <Link
                            href={`/${orgSlug}/finance/payments/${entry.paymentId}`}
                            className="text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>{entry.paymentNumber}</span>
                          </Link>
                        )}
                        {entry.expenseNumber && (
                          <Link
                            href={`/${orgSlug}/finance/expenses/${entry.expenseId}`}
                            className="text-rose-400 hover:underline flex items-center gap-1"
                          >
                            <Receipt className="h-3 w-3" />
                            <span>{entry.expenseNumber}</span>
                          </Link>
                        )}
                        {!entry.invoiceNumber && !entry.paymentNumber && !entry.expenseNumber && (
                          <span className="text-muted-foreground">
                            {entry.referenceType || '—'}
                          </span>
                        )}
                      </td>

                      {/* Recorded By */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground text-[11px]">
                        {entry.createdByName || entry.createdByEmail || 'System'}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold">
                        <span
                          className={
                            entry.type === LedgerEntryType.REVENUE
                              ? isNegative
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                              : isNegative
                              ? 'text-blue-400'
                              : 'text-rose-400'
                          }
                        >
                          {isNegative ? '-' : '+'}${Math.abs(amountNum).toFixed(2)}
                        </span>
                      </td>

                      {/* Inspect Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Inspect Ledger Entry"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
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
              {Math.min(safePageNum * PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: READ-ONLY LEDGER ENTRY INSPECTOR
         ═══════════════════════════════════════════════════════════════════════ */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Journal Entry Audit Detail</h2>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    ID: {selectedEntry.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Breakdown */}
            <div className="space-y-4 text-xs">
              {/* Amount & Type Card */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Entry Classification
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border ${
                        getLedgerEntryBadge(
                          selectedEntry.type,
                          selectedEntry.referenceType,
                          parseFloat(selectedEntry.amount)
                        ).cls
                      }`}
                    >
                      {
                        getLedgerEntryBadge(
                          selectedEntry.type,
                          selectedEntry.referenceType,
                          parseFloat(selectedEntry.amount)
                        ).label
                      }
                    </span>
                    <span className="text-muted-foreground">
                      ({ledgerReferenceTypeLabels[selectedEntry.referenceType] || selectedEntry.referenceType})
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Ledger Amount
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono mt-0.5 ${
                      selectedEntry.type === LedgerEntryType.REVENUE
                        ? parseFloat(selectedEntry.amount) < 0
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                        : parseFloat(selectedEntry.amount) < 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {parseFloat(selectedEntry.amount) < 0 ? '-' : '+'}$
                    {Math.abs(parseFloat(selectedEntry.amount)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Memo & Description */}
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Description / Memo
                </div>
                <div className="rounded-lg border border-border bg-background p-3 text-xs text-foreground font-medium leading-relaxed">
                  {selectedEntry.description}
                </div>
              </div>

              {/* Transaction Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Calendar className="h-3.5 w-3.5" /> Effective Date
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {selectedEntry.entryDate.split('T')[0]}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Clock className="h-3.5 w-3.5" /> Created Timestamp
                  </span>
                  <span className="font-mono font-medium text-foreground text-[11px]">
                    {new Date(selectedEntry.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <User className="h-3.5 w-3.5" /> Recorded By
                  </span>
                  <span className="text-foreground truncate block">
                    {selectedEntry.createdByName || selectedEntry.createdByEmail || 'System'}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Hash className="h-3.5 w-3.5" /> Reference Type
                  </span>
                  <span className="font-mono text-foreground truncate block">
                    {selectedEntry.referenceType}
                  </span>
                </div>
              </div>

              {/* Linked Entity Card */}
              {(selectedEntry.invoiceNumber || selectedEntry.paymentNumber || selectedEntry.expenseNumber) && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Linked Workspace Entity
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.invoiceNumber && (
                      <Link
                        href={`/${orgSlug}/finance/invoices/${selectedEntry.invoiceId}`}
                        className="inline-flex items-center space-x-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Invoice: {selectedEntry.invoiceNumber}</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    )}
                    {selectedEntry.paymentNumber && (
                      <Link
                        href={`/${orgSlug}/finance/payments/${selectedEntry.paymentId}`}
                        className="inline-flex items-center space-x-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Payment: {selectedEntry.paymentNumber}</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    )}
                    {selectedEntry.expenseNumber && (
                      <Link
                        href={`/${orgSlug}/finance/expenses/${selectedEntry.expenseId}`}
                        className="inline-flex items-center space-x-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Expense: {selectedEntry.expenseNumber}</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Audit Lock Guarantee */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground flex items-center space-x-2">
                <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-foreground">Append-Only Audit Record:</strong> This entry cannot be modified or deleted. Double-entry integrity is mathematically guaranteed.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
