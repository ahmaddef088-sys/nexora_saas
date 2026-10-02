'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role, PaymentStatus, PaymentMethod, InvoiceStatus } from '@prisma/client';
import {
  CreditCard,
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
  DollarSign,
  ArrowRight,
  AlertTriangle,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Receipt,
  Wallet,
} from 'lucide-react';
import { recordPaymentAction, refundPaymentAction } from '@/lib/actions/payments';
import { canRecordPayment, canRefundPayment } from '@/lib/auth/finance-auth';
import { paymentMethodLabels } from '@/lib/utils/payment-constants';

// ─── Data Types ───────────────────────────────────────────────────────────────

export interface SerializedPayment {
  id: string;
  paymentNumber: string;
  amount: string;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  invoiceTotal: string;
  invoiceBalance: string;
  customerId: string;
  customerName: string;
  customerCompany: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface PayableInvoiceOption {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerCompany: string | null;
  status: InvoiceStatus;
  total: string;
  paidAmount: string;
  balance: string;
  dueDate: string;
}

interface PaymentsManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  payments: SerializedPayment[];
  payableInvoices: PayableInvoiceOption[];
}

const PAGE_SIZE = 15;

// ─── Method & Status Helpers ──────────────────────────────────────────────────

// paymentMethodLabels is imported from '@/lib/utils/payment-constants'
// (shared between Server and Client components — not declared here to avoid RSC client manifest errors)

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    case PaymentStatus.REFUNDED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
          <RotateCcw className="h-3 w-3" />
          Refunded
        </span>
      );
    case PaymentStatus.FAILED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          {status}
        </span>
      );
  }
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function PaymentsManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  payments,
  payableInvoices,
}: PaymentsManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Permissions ────────────────────────────────────────────────────────────
  const canRecord = canRecordPayment(currentUserRole).allowed;
  const canRefund = canRefundPayment(currentUserRole).allowed;

  // ── Filters & Search ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [refundingPayment, setRefundingPayment] = useState<SerializedPayment | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // ── Record Form State ──────────────────────────────────────────────────────
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // ── Selected Invoice helper ────────────────────────────────────────────────
  const selectedInvoice = useMemo(() => {
    return payableInvoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [payableInvoices, selectedInvoiceId]);

  // When invoice selection changes, suggest full remaining balance
  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = payableInvoices.find((i) => i.id === invId);
    if (inv) {
      setPaymentAmount(parseFloat(inv.balance).toFixed(2));
    } else {
      setPaymentAmount('');
    }
  };

  const resetRecordForm = () => {
    setSelectedInvoiceId('');
    setPaymentAmount('');
    setPaymentMethod(PaymentMethod.BANK_TRANSFER);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setNotes('');
  };

  // ── Filtered & Paginated Payments ──────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return payments.filter((p) => {
      const matchesSearch =
        q === '' ||
        p.paymentNumber.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        (p.customerCompany?.toLowerCase().includes(q) ?? false) ||
        (p.reference?.toLowerCase().includes(q) ?? false) ||
        (p.notes?.toLowerCase().includes(q) ?? false);

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesMethod = methodFilter === 'ALL' || p.paymentMethod === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [payments, searchQuery, statusFilter, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const safePageNum = Math.min(page, totalPages);
  const pagedPayments = filteredPayments.slice((safePageNum - 1) * PAGE_SIZE, safePageNum * PAGE_SIZE);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const completedPayments = payments.filter((p) => p.status === PaymentStatus.COMPLETED);
    const refundedPayments = payments.filter((p) => p.status === PaymentStatus.REFUNDED);

    const totalCollected = completedPayments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    const totalRefunded = refundedPayments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    const netRevenue = totalCollected - totalRefunded;

    return {
      totalCount: payments.length,
      completedCount: completedPayments.length,
      refundedCount: refundedPayments.length,
      totalCollected,
      totalRefunded,
      netRevenue,
      payableInvoicesCount: payableInvoices.length,
    };
  }, [payments, payableInvoices]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedInvoiceId) {
      setFeedback({ type: 'error', message: 'Please select an invoice to apply payment to.' });
      return;
    }

    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive payment amount.' });
      return;
    }

    startTransition(async () => {
      const res = await recordPaymentAction(orgSlug, {
        invoiceId: selectedInvoiceId,
        amount: numAmount,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Payment recorded successfully.' });
        setIsRecordModalOpen(false);
        resetRecordForm();
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to record payment.' });
      }
    });
  };

  const handleRefundPayment = async () => {
    if (!refundingPayment) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await refundPaymentAction(orgSlug, {
        paymentId: refundingPayment.id,
        reason: refundReason.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Payment refunded successfully.' });
        setRefundingPayment(null);
        setRefundReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to refund payment.' });
        setRefundingPayment(null);
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Payments & Collections</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {metrics.totalCount} {metrics.totalCount === 1 ? 'Transaction' : 'Transactions'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Reconcile payments, track recognized revenue, and record receipts for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canRecord ? (
            <button
              id="record-payment-btn"
              type="button"
              onClick={() => {
                resetRecordForm();
                setFeedback(null);
                setIsRecordModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Record Payment</span>
            </button>
          ) : (
            <div
              title="Only Owner and Admin can record payments"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Record Payment (Restricted)</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Received</div>
          <div className="text-xl font-bold text-emerald-400">${metrics.totalCollected.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{metrics.completedCount} completed receipts</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Refunds</div>
          <div className="text-xl font-bold text-amber-400">${metrics.totalRefunded.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{metrics.refundedCount} reversed payments</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Net Collected</div>
          <div className="text-xl font-bold text-primary">${metrics.netRevenue.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">Recognized cash inflow</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Completed</div>
          <div className="text-xl font-bold text-foreground">{metrics.completedCount}</div>
          <div className="text-[10px] text-muted-foreground">Settled transactions</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Refunded</div>
          <div className="text-xl font-bold text-amber-400">{metrics.refundedCount}</div>
          <div className="text-[10px] text-muted-foreground">Reversed transactions</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Payable Invoices</div>
          <div className="text-xl font-bold text-blue-400">{metrics.payableInvoicesCount}</div>
          <div className="text-[10px] text-muted-foreground">Open invoices awaiting pay</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="payment-search"
            type="text"
            placeholder="Search by payment #, invoice #, customer, ref..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value={PaymentStatus.COMPLETED}>Completed</option>
              <option value={PaymentStatus.REFUNDED}>Refunded</option>
              <option value={PaymentStatus.FAILED}>Failed</option>
            </select>
          </div>

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
              <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
              <option value={PaymentMethod.CREDIT_CARD}>Credit Card</option>
              <option value={PaymentMethod.CASH}>Cash</option>
              <option value={PaymentMethod.CHECK}>Check</option>
              <option value={PaymentMethod.STRIPE}>Stripe</option>
              <option value={PaymentMethod.OTHER}>Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Payment #</th>
                <th className="px-4 py-3">Invoice / Status</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-xs">
                        {searchQuery || statusFilter !== 'ALL' || methodFilter !== 'ALL'
                          ? 'No payments match your filters.'
                          : 'No payments recorded yet.'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/75 max-w-xs">
                        {searchQuery || statusFilter !== 'ALL' || methodFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or reset filters.'
                          : 'Record a payment against an open invoice to recognize revenue.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedPayments.map((payment) => {
                  const isRefunded = payment.status === PaymentStatus.REFUNDED;

                  return (
                    <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                      {/* Payment # */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/${orgSlug}/finance/payments/${payment.id}`}
                          className="font-mono font-bold text-primary hover:underline"
                        >
                          {payment.paymentNumber}
                        </Link>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          By {payment.createdByName || payment.createdByEmail || 'System'}
                        </div>
                      </td>

                      {/* Invoice Link & Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/${orgSlug}/finance/invoices/${payment.invoiceId}`}
                          className="font-mono text-primary/90 hover:text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          <FileText className="h-3 w-3" />
                          {payment.invoiceNumber}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">
                          {payment.invoiceStatus}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{payment.customerName}</div>
                        {payment.customerCompany && (
                          <div className="text-[11px] text-muted-foreground flex items-center space-x-1">
                            <Building className="h-3 w-3 shrink-0" />
                            <span>{payment.customerCompany}</span>
                          </div>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/60 border border-border text-foreground">
                          {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {payment.reference || '—'}
                      </td>

                      {/* Payment Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {payment.paymentDate.split('T')[0]}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <PaymentStatusBadge status={payment.status} />
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-bold">
                        <span
                          className={
                            isRefunded
                              ? 'text-amber-400 line-through'
                              : 'text-emerald-400 font-mono'
                          }
                        >
                          ${parseFloat(payment.amount).toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Link
                            href={`/${orgSlug}/finance/payments/${payment.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="View Payment Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {/* Refund Action (OWNER only, COMPLETED status only) */}
                          {payment.status === PaymentStatus.COMPLETED && canRefund && (
                            <button
                              type="button"
                              onClick={() => {
                                setRefundingPayment(payment);
                                setRefundReason('');
                                setFeedback(null);
                              }}
                              disabled={isPending}
                              title="Refund Payment"
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium border border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Refund</span>
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
              {Math.min(safePageNum * PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length}
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
          MODAL: RECORD PAYMENT
         ═══════════════════════════════════════════════════════════════════════ */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Record Payment</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Record a receipt against an open invoice and create an immutable ledger entry.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              {/* Invoice Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Invoice <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Select an open invoice —</option>
                  {payableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customerName} (Due: ${parseFloat(inv.balance).toFixed(2)}) [{inv.status}]
                    </option>
                  ))}
                </select>
                {payableInvoices.length === 0 && (
                  <p className="text-[11px] text-amber-400 flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    No open invoices available for payment. Issue an invoice first.
                  </p>
                )}
              </div>

              {/* Selected Invoice Details Card (Display Only) */}
              {selectedInvoice && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary font-mono">{selectedInvoice.invoiceNumber}</span>
                    <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-muted-foreground pt-1 border-t border-primary/10">
                    <div>
                      <div className="text-[10px]">Total</div>
                      <div className="font-mono font-semibold text-foreground">
                        ${parseFloat(selectedInvoice.total).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px]">Already Paid</div>
                      <div className="font-mono font-semibold text-emerald-400">
                        ${parseFloat(selectedInvoice.paidAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px]">Current Balance</div>
                      <div className="font-mono font-semibold text-amber-400">
                        ${parseFloat(selectedInvoice.balance).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Amount & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Amount ($) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {selectedInvoice && (
                    <div className="text-[10px] text-muted-foreground">
                      Max payable: ${parseFloat(selectedInvoice.balance).toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Method <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                    <option value={PaymentMethod.CREDIT_CARD}>Credit Card</option>
                    <option value={PaymentMethod.CASH}>Cash</option>
                    <option value={PaymentMethod.CHECK}>Check</option>
                    <option value={PaymentMethod.STRIPE}>Stripe</option>
                    <option value={PaymentMethod.OTHER}>Other</option>
                  </select>
                </div>
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Reference / Check # (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Wire ref, receipt ID"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Additional payment details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Informational Callout */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Ledger Integration:</strong> Recording this payment automatically creates an immutable <span className="text-emerald-400 font-medium">REVENUE</span> ledger entry and adjusts the invoice status atomically.
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || payableInvoices.length === 0}
                  className="inline-flex items-center space-x-2 rounded-md bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: REFUND PAYMENT CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      {refundingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Refund Payment</h2>
                <p className="text-xs text-muted-foreground font-mono">{refundingPayment.paymentNumber}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Warning
              </div>
              <p>
                Refunding <strong>${parseFloat(refundingPayment.amount).toFixed(2)}</strong> will create an offsetting negative revenue ledger entry, restore the outstanding balance on Invoice <strong>{refundingPayment.invoiceNumber}</strong>, and transition the payment status to <span className="font-semibold">REFUNDED</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Refund Reason (optional)
              </label>
              <textarea
                rows={2}
                maxLength={250}
                placeholder="Reason for reversing this transaction..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setRefundingPayment(null);
                  setRefundReason('');
                }}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundPayment}
                disabled={isPending}
                className="inline-flex items-center space-x-2 rounded-md bg-amber-600 px-5 py-2 text-xs font-medium text-white shadow hover:bg-amber-700 transition-colors disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span>Confirm Refund</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
