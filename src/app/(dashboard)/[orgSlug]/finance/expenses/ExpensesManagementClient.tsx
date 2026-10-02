'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role, ExpenseCategory, PaymentMethod } from '@prisma/client';
import {
  DollarSign,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Eye,
  Lock,
  Building,
  Filter,
  Calendar,
  CreditCard,
  Pencil,
  Trash2,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  TrendingDown,
  Tag,
  FileText,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from '@/lib/actions/expenses';
import {
  canCreateExpense,
  canEditExpense,
  canDeleteExpense,
} from '@/lib/auth/finance-auth';
import {
  expenseCategoryLabels,
  expenseCategoryBadges,
} from '@/lib/utils/expense-constants';
import { paymentMethodLabels } from '@/lib/utils/payment-constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedExpense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  payee: string;
  amount: string;
  taxAmount: string;
  total: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  reference: string | null;
  notes: string | null;
  receiptUrl: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

interface ExpensesManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  expenses: SerializedExpense[];
}

const PAGE_SIZE = 15;

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpensesManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  expenses,
}: ExpensesManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Permissions ────────────────────────────────────────────────────────────
  const canCreate = canCreateExpense(currentUserRole).allowed;
  const canEdit = canEditExpense(currentUserRole).allowed;
  const canDelete = canDeleteExpense(currentUserRole).allowed;

  // ── Filters & Search ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Modal states ───────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SerializedExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<SerializedExpense | null>(null);

  // ── Form State ─────────────────────────────────────────────────────────────
  const [formCategory, setFormCategory] = useState<ExpenseCategory>(ExpenseCategory.OFFICE_SUPPLIES);
  const [formPayee, setFormPayee] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTaxAmount, setFormTaxAmount] = useState('0');
  const [formExpenseDate, setFormExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [formReference, setFormReference] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formReceiptUrl, setFormReceiptUrl] = useState('');

  const resetForm = () => {
    setFormCategory(ExpenseCategory.OFFICE_SUPPLIES);
    setFormPayee('');
    setFormAmount('');
    setFormTaxAmount('0');
    setFormExpenseDate(new Date().toISOString().split('T')[0]);
    setFormPaymentMethod(PaymentMethod.BANK_TRANSFER);
    setFormReference('');
    setFormNotes('');
    setFormReceiptUrl('');
    setEditingExpense(null);
  };

  const openCreateModal = () => {
    resetForm();
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (exp: SerializedExpense) => {
    setEditingExpense(exp);
    setFormCategory(exp.category);
    setFormPayee(exp.payee);
    setFormAmount(parseFloat(exp.amount).toFixed(2));
    setFormTaxAmount(parseFloat(exp.taxAmount).toFixed(2));
    setFormExpenseDate(exp.expenseDate.split('T')[0]);
    setFormPaymentMethod(exp.paymentMethod);
    setFormReference(exp.reference || '');
    setFormNotes(exp.notes || '');
    setFormReceiptUrl(exp.receiptUrl || '');
    setFeedback(null);
    setIsModalOpen(true);
  };

  // ── Filtered & Paginated List ──────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter((e) => {
      const matchesSearch =
        q === '' ||
        e.expenseNumber.toLowerCase().includes(q) ||
        e.payee.toLowerCase().includes(q) ||
        (e.reference?.toLowerCase().includes(q) ?? false) ||
        (e.notes?.toLowerCase().includes(q) ?? false) ||
        expenseCategoryLabels[e.category]?.toLowerCase().includes(q);

      const matchesCategory = categoryFilter === 'ALL' || e.category === categoryFilter;
      const matchesMethod = methodFilter === 'ALL' || e.paymentMethod === methodFilter;

      return matchesSearch && matchesCategory && matchesMethod;
    });
  }, [expenses, searchQuery, categoryFilter, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const safePageNum = Math.min(page, totalPages);
  const pagedExpenses = filteredExpenses.slice((safePageNum - 1) * PAGE_SIZE, safePageNum * PAGE_SIZE);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalSpent = expenses.reduce((acc, e) => acc + parseFloat(e.total), 0);
    const totalTax = expenses.reduce((acc, e) => acc + parseFloat(e.taxAmount), 0);
    const totalNet = expenses.reduce((acc, e) => acc + parseFloat(e.amount), 0);
    const count = expenses.length;
    const avgExpense = count > 0 ? totalSpent / count : 0;

    // Top category calculation
    const categoryTotals: Record<string, number> = {};
    for (const exp of expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + parseFloat(exp.total);
    }
    let topCategory = '—';
    let topCategoryAmount = 0;
    for (const [cat, amt] of Object.entries(categoryTotals)) {
      if (amt > topCategoryAmount) {
        topCategoryAmount = amt;
        topCategory = expenseCategoryLabels[cat as ExpenseCategory] || cat;
      }
    }

    return {
      totalSpent,
      totalTax,
      totalNet,
      count,
      avgExpense,
      topCategory,
      topCategoryAmount,
    };
  }, [expenses]);

  // ── Form Estimated Total Preview (display only) ────────────────────────────
  const formEstimatedTotal = useMemo(() => {
    const numAmount = parseFloat(formAmount) || 0;
    const numTax = parseFloat(formTaxAmount) || 0;
    return (numAmount + numTax).toFixed(2);
  }, [formAmount, formTaxAmount]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numAmount = parseFloat(formAmount);
    const numTax = parseFloat(formTaxAmount) || 0;

    if (!formPayee.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a payee/vendor name.' });
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive expense amount.' });
      return;
    }

    startTransition(async () => {
      if (editingExpense) {
        // Update Action
        const res = await updateExpenseAction(orgSlug, {
          expenseId: editingExpense.id,
          category: formCategory,
          payee: formPayee.trim(),
          amount: numAmount,
          taxAmount: numTax,
          expenseDate: new Date(formExpenseDate),
          paymentMethod: formPaymentMethod,
          reference: formReference.trim() || undefined,
          notes: formNotes.trim() || undefined,
          receiptUrl: formReceiptUrl.trim() || undefined,
        });

        if (res.success) {
          setFeedback({ type: 'success', message: res.message || 'Expense updated successfully.' });
          setIsModalOpen(false);
          resetForm();
          router.refresh();
        } else {
          setFeedback({ type: 'error', message: res.error || 'Failed to update expense.' });
        }
      } else {
        // Create Action
        const res = await createExpenseAction(orgSlug, {
          category: formCategory,
          payee: formPayee.trim(),
          amount: numAmount,
          taxAmount: numTax,
          expenseDate: new Date(formExpenseDate),
          paymentMethod: formPaymentMethod,
          reference: formReference.trim() || undefined,
          notes: formNotes.trim() || undefined,
          receiptUrl: formReceiptUrl.trim() || undefined,
        });

        if (res.success) {
          setFeedback({ type: 'success', message: res.message || 'Expense logged successfully.' });
          setIsModalOpen(false);
          resetForm();
          router.refresh();
        } else {
          setFeedback({ type: 'error', message: res.error || 'Failed to create expense.' });
        }
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingExpense) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteExpenseAction(orgSlug, {
        expenseId: deletingExpense.id,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Expense deleted successfully.' });
        setDeletingExpense(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to delete expense.' });
        setDeletingExpense(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
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
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground ml-4"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses Management</h1>
            <span className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400">
              {metrics.count} {metrics.count === 1 ? 'Expense' : 'Expenses'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track operational spending, vendor payouts, and outgoing costs for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate ? (
            <button
              id="log-expense-btn"
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Log Expense</span>
            </button>
          ) : (
            <div
              title="Only Owner and Admin can log expenses"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Log Expense (Restricted)</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Expenses</div>
          <div className="text-xl font-bold text-rose-400 font-mono">${metrics.totalSpent.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{metrics.count} total records</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Net (Pre-tax)</div>
          <div className="text-xl font-bold text-foreground font-mono">${metrics.totalNet.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">Direct operational costs</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tax on Expenses</div>
          <div className="text-xl font-bold text-amber-400 font-mono">${metrics.totalTax.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">Input tax deductions</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg. Expense</div>
          <div className="text-xl font-bold text-foreground font-mono">${metrics.avgExpense.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">Per logged transaction</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Top Category</div>
          <div className="text-sm font-bold text-primary truncate" title={metrics.topCategory}>
            {metrics.topCategory}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">${metrics.topCategoryAmount.toFixed(2)}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Count</div>
          <div className="text-xl font-bold text-foreground">{metrics.count}</div>
          <div className="text-[10px] text-muted-foreground">Recorded vouchers</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="expense-search"
            type="text"
            placeholder="Search by expense #, payee, reference, notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Categories</option>
              {Object.entries(expenseCategoryLabels).map(([cat, label]) => (
                <option key={cat} value={cat}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center space-x-2">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Method:</span>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Methods</option>
              {Object.entries(paymentMethodLabels).map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Expense #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Payee / Vendor</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Net Amount</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-xs">
                        {searchQuery || categoryFilter !== 'ALL' || methodFilter !== 'ALL'
                          ? 'No expenses match your filters.'
                          : 'No expenses logged yet.'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/75 max-w-xs">
                        {searchQuery || categoryFilter !== 'ALL' || methodFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or reset filters.'
                          : 'Log an operational expense to track business spending.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedExpenses.map((expense) => {
                  const badge = expenseCategoryBadges[expense.category] || {
                    label: expense.category,
                    cls: 'bg-muted text-muted-foreground border-border',
                  };

                  return (
                    <tr key={expense.id} className="hover:bg-muted/20 transition-colors">
                      {/* Expense # */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/${orgSlug}/finance/expenses/${expense.id}`}
                          className="font-mono font-bold text-primary hover:underline"
                        >
                          {expense.expenseNumber}
                        </Link>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          By {expense.createdByName || expense.createdByEmail || 'System'}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {expense.expenseDate.split('T')[0]}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Payee */}
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {expense.payee}
                        {expense.receiptUrl && (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[10px] text-primary hover:underline ml-2"
                            title="Open Receipt Link"
                          >
                            Receipt <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                          </a>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/60 border border-border text-foreground">
                          {paymentMethodLabels[expense.paymentMethod] || expense.paymentMethod}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {expense.reference || '—'}
                      </td>

                      {/* Net Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono text-muted-foreground">
                        ${parseFloat(expense.amount).toFixed(2)}
                      </td>

                      {/* Tax Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono text-muted-foreground">
                        ${parseFloat(expense.taxAmount).toFixed(2)}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-rose-400">
                        ${parseFloat(expense.total).toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <Link
                            href={`/${orgSlug}/finance/expenses/${expense.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="View Expense Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(expense)}
                              disabled={isPending}
                              title="Edit Expense"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingExpense(expense);
                                setFeedback(null);
                              }}
                              disabled={isPending}
                              title="Delete Expense"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {(safePageNum - 1) * PAGE_SIZE + 1}–
              {Math.min(safePageNum * PAGE_SIZE, filteredExpenses.length)} of {filteredExpenses.length}
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
          MODAL: LOG / EDIT EXPENSE
         ═══════════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {editingExpense ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editingExpense ? `Edit Expense — ${editingExpense.expenseNumber}` : 'Log New Expense'}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {editingExpense
                      ? 'Updating an expense creates an offsetting ledger entry to preserve immutable history.'
                      : 'Records operational expense and automatically registers an immutable ledger entry.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Category & Payee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Category <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Object.entries(expenseCategoryLabels).map(([cat, label]) => (
                      <option key={cat} value={cat}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Payee / Vendor <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    placeholder="e.g. AWS, Office Depot, Landlord Inc."
                    value={formPayee}
                    onChange={(e) => setFormPayee(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Net Amount & Tax Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Net Amount ($) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tax Amount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formTaxAmount}
                    onChange={(e) => setFormTaxAmount(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Estimated Total Display Card */}
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground">Estimated Total:</span>
                  <span className="text-muted-foreground ml-1.5 text-[11px]">
                    (Net ${parseFloat(formAmount || '0').toFixed(2)} + Tax ${parseFloat(formTaxAmount || '0').toFixed(2)})
                  </span>
                </div>
                <div className="font-mono font-bold text-rose-400 text-base">
                  ${formEstimatedTotal}
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Expense Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formExpenseDate}
                    onChange={(e) => setFormExpenseDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Method <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Object.entries(paymentMethodLabels).map(([method, label]) => (
                      <option key={method} value={method}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference & Receipt URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Reference / Invoice # (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. INV-9982, Receipt #441"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Receipt Link / Document URL (optional)
                  </label>
                  <input
                    type="url"
                    maxLength={500}
                    placeholder="https://..."
                    value={formReceiptUrl}
                    onChange={(e) => setFormReceiptUrl(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes / Business Purpose (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Describe business purpose or additional details..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
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
                  <span>{editingExpense ? 'Update Expense' : 'Log Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: DELETE CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Delete Expense</h2>
                <p className="text-xs text-muted-foreground font-mono">{deletingExpense.expenseNumber}</p>
              </div>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Immutable Ledger Reversal
              </div>
              <p>
                Deleting expense <strong>{deletingExpense.expenseNumber}</strong> ({expenseCategoryLabels[deletingExpense.category]} — ${parseFloat(deletingExpense.total).toFixed(2)}) will record an offsetting negative <span className="font-semibold font-mono">EXPENSE</span> ledger entry to neutralize the financial impact in historical reporting.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeletingExpense(null)}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center space-x-2 rounded-md bg-destructive px-5 py-2 text-xs font-medium text-destructive-foreground shadow hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Confirm Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
