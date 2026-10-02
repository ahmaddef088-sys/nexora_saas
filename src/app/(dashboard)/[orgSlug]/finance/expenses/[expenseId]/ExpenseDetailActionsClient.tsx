'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, ExpenseCategory, PaymentMethod } from '@prisma/client';
import {
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { updateExpenseAction, deleteExpenseAction } from '@/lib/actions/expenses';
import { canEditExpense, canDeleteExpense } from '@/lib/auth/finance-auth';
import { expenseCategoryLabels } from '@/lib/utils/expense-constants';
import { paymentMethodLabels } from '@/lib/utils/payment-constants';

interface ExpenseDetailActionsClientProps {
  orgSlug: string;
  expenseId: string;
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
  currentUserRole: Role;
}

export function ExpenseDetailActionsClient({
  orgSlug,
  expenseId,
  expenseNumber,
  category,
  payee,
  amount,
  taxAmount,
  total,
  expenseDate,
  paymentMethod,
  reference,
  notes,
  receiptUrl,
  currentUserRole,
}: ExpenseDetailActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ─── Edit Form State ────────────────────────────────────────────────────────
  const [formCategory, setFormCategory] = useState<ExpenseCategory>(category);
  const [formPayee, setFormPayee] = useState(payee);
  const [formAmount, setFormAmount] = useState(amount);
  const [formTaxAmount, setFormTaxAmount] = useState(taxAmount);
  const [formExpenseDate, setFormExpenseDate] = useState(expenseDate.split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>(paymentMethod);
  const [formReference, setFormReference] = useState(reference || '');
  const [formNotes, setFormNotes] = useState(notes || '');
  const [formReceiptUrl, setFormReceiptUrl] = useState(receiptUrl || '');

  // ─── Permissions ────────────────────────────────────────────────────────────
  const canEdit = canEditExpense(currentUserRole).allowed;
  const canDelete = canDeleteExpense(currentUserRole).allowed;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numAmount = parseFloat(formAmount);
    const numTax = parseFloat(formTaxAmount) || 0;

    if (!formPayee.trim()) {
      setFeedback({ type: 'error', message: 'Payee name is required.' });
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: 'Amount must be greater than 0.' });
      return;
    }

    startTransition(async () => {
      const res = await updateExpenseAction(orgSlug, {
        expenseId,
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
        setShowEditModal(false);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update expense.' });
      }
    });
  };

  const handleDelete = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteExpenseAction(orgSlug, { expenseId });

      if (res.success) {
        setShowDeleteConfirm(false);
        router.push(`/${orgSlug}/finance/expenses`);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to delete expense.' });
        setShowDeleteConfirm(false);
      }
    });
  };

  if (!canEdit && !canDelete && !feedback) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between p-3 rounded-lg border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setFormCategory(category);
              setFormPayee(payee);
              setFormAmount(amount);
              setFormTaxAmount(taxAmount);
              setFormExpenseDate(expenseDate.split('T')[0]);
              setFormPaymentMethod(paymentMethod);
              setFormReference(reference || '');
              setFormNotes(notes || '');
              setFormReceiptUrl(receiptUrl || '');
              setShowEditModal(true);
              setFeedback(null);
            }}
            disabled={isPending}
            className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit Expense</span>
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm(true);
              setFeedback(null);
            }}
            disabled={isPending}
            className="inline-flex items-center space-x-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Expense</span>
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: EDIT EXPENSE
         ═══════════════════════════════════════════════════════════════════════ */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Edit Expense — {expenseNumber}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Modifying amounts registers offsetting audit ledger entries automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
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
                    value={formPayee}
                    onChange={(e) => setFormPayee(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

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
                    value={formTaxAmount}
                    onChange={(e) => setFormTaxAmount(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Reference / Invoice # (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Receipt URL (optional)
                  </label>
                  <input
                    type="url"
                    maxLength={500}
                    value={formReceiptUrl}
                    onChange={(e) => setFormReceiptUrl(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: DELETE EXPENSE CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Delete Expense</h2>
                <p className="text-xs text-muted-foreground font-mono">{expenseNumber}</p>
              </div>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Immutable Ledger Reversal Warning
              </div>
              <p>
                Deleting expense <strong>{expenseNumber}</strong> ({expenseCategoryLabels[category]} — ${parseFloat(total).toFixed(2)}) will write an offsetting negative <span className="font-semibold font-mono">EXPENSE</span> ledger entry to preserve immutable double-entry accounting records.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
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
