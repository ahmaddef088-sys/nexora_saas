'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PaymentStatus } from '@prisma/client';
import {
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { refundPaymentAction } from '@/lib/actions/payments';
import { canRefundPayment } from '@/lib/auth/finance-auth';

interface PaymentDetailActionsClientProps {
  orgSlug: string;
  paymentId: string;
  paymentNumber: string;
  amount: string;
  status: PaymentStatus;
  invoiceNumber: string;
  currentUserRole: Role;
}

export function PaymentDetailActionsClient({
  orgSlug,
  paymentId,
  paymentNumber,
  amount,
  status,
  invoiceNumber,
  currentUserRole,
}: PaymentDetailActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  // ─── Permissions ────────────────────────────────────────────────────────────
  const canRefund = canRefundPayment(currentUserRole).allowed && status === PaymentStatus.COMPLETED;

  const handleRefund = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await refundPaymentAction(orgSlug, {
        paymentId,
        reason: refundReason.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Payment refunded successfully.' });
        setShowRefundConfirm(false);
        setRefundReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to refund payment.' });
        setShowRefundConfirm(false);
      }
    });
  };

  if (!canRefund && !feedback) {
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
      {canRefund && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowRefundConfirm(true);
              setRefundReason('');
              setFeedback(null);
            }}
            disabled={isPending}
            className="inline-flex items-center space-x-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-400 shadow-sm hover:bg-amber-500/20 transition-colors disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Refund / Reverse Payment</span>
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Refund Confirmation
         ═══════════════════════════════════════════════════════════════════════ */}
      {showRefundConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Refund Payment</h2>
                <p className="text-xs text-muted-foreground font-mono">{paymentNumber}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Financial Reversal Warning
              </div>
              <p>
                Refunding <strong>${parseFloat(amount).toFixed(2)}</strong> will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-300/90 pl-1 pt-1">
                <li>Create an offsetting negative revenue ledger entry.</li>
                <li>Increase the unpaid balance on Invoice <strong>{invoiceNumber}</strong>.</li>
                <li>Recalculate the invoice status atomically.</li>
                <li>Mark this payment record as <span className="font-semibold">REFUNDED</span> (preserved in audit log).</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Refund Reason (optional)
              </label>
              <textarea
                rows={2}
                maxLength={250}
                placeholder="Why is this payment being reversed?"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRefundConfirm(false);
                  setRefundReason('');
                }}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
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
