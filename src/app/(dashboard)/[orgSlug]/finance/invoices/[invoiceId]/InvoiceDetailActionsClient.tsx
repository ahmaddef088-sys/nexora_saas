'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role, InvoiceStatus } from '@prisma/client';
import {
  Send,
  Ban,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { issueInvoiceAction, voidInvoiceAction } from '@/lib/actions/invoices';
import {
  canEditInvoice,
  canIssueInvoice,
  canVoidInvoice,
} from '@/lib/auth/finance-auth';

interface InvoiceDetailActionsClientProps {
  orgSlug: string;
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  paidAmount: string;
  currentUserRole: Role;
}

export function InvoiceDetailActionsClient({
  orgSlug,
  invoiceId,
  invoiceNumber,
  status,
  paidAmount,
  currentUserRole,
}: InvoiceDetailActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showIssueConfirm, setShowIssueConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // ─── Permissions ────────────────────────────────────────────────────────────
  const canEdit = canEditInvoice(currentUserRole, status).allowed;
  const canIssue = canIssueInvoice(currentUserRole).allowed && status === InvoiceStatus.DRAFT;
  const canVoid = canVoidInvoice(currentUserRole).allowed &&
    ([InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE] as InvoiceStatus[]).includes(status);
  const hasPaidAmount = parseFloat(paidAmount) > 0;

  const handleIssue = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await issueInvoiceAction(orgSlug, { invoiceId });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice issued successfully.' });
        setShowIssueConfirm(false);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to issue invoice.' });
        setShowIssueConfirm(false);
      }
    });
  };

  const handleVoid = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await voidInvoiceAction(orgSlug, {
        invoiceId,
        reason: voidReason.trim() || undefined,
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invoice voided.' });
        setShowVoidConfirm(false);
        setVoidReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to void invoice.' });
        setShowVoidConfirm(false);
      }
    });
  };

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
            {feedback.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />
            }
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Edit Draft */}
        {canEdit && (
          <Link
            href={`/${orgSlug}/finance/invoices?edit=${invoiceId}`}
            className="inline-flex items-center space-x-2 rounded-md border border-border bg-muted/40 px-4 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit Draft</span>
          </Link>
        )}

        {/* Issue Invoice */}
        {canIssue && (
          <button
            type="button"
            onClick={() => { setShowIssueConfirm(true); setFeedback(null); }}
            disabled={isPending}
            className="inline-flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Issue Invoice</span>
          </button>
        )}

        {/* Void Invoice */}
        {canVoid && (
          <button
            type="button"
            onClick={() => { setShowVoidConfirm(true); setVoidReason(''); setFeedback(null); }}
            disabled={isPending}
            className="inline-flex items-center space-x-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
          >
            <Ban className="h-3.5 w-3.5" />
            <span>Void Invoice</span>
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Issue Confirmation
         ═══════════════════════════════════════════════════════════════════════ */}
      {showIssueConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Issue Invoice</h2>
                <p className="text-xs text-muted-foreground font-mono">{invoiceNumber}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Irreversible Action
              </div>
              <p>
                Once issued, the invoice snapshot is permanently locked — line items and totals cannot be modified.
                The invoice status will change from DRAFT to ISSUED and will be ready to accept payments.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowIssueConfirm(false)}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleIssue}
                disabled={isPending}
                className="inline-flex items-center space-x-2 rounded-md bg-blue-600 px-5 py-2 text-xs font-medium text-white shadow hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Confirm — Issue Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Void Confirmation
         ═══════════════════════════════════════════════════════════════════════ */}
      {showVoidConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Void Invoice</h2>
                <p className="text-xs text-muted-foreground font-mono">{invoiceNumber}</p>
              </div>
            </div>

            {hasPaidAmount ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Cannot Void
                </div>
                <p>
                  This invoice has ${parseFloat(paidAmount).toFixed(2)} in recorded payments.
                  All payments must be refunded before this invoice can be voided.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                  Voiding permanently cancels this invoice. The record is preserved for audit purposes.
                  Since no payments have been received, no ledger reversal is required.
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
                    placeholder="Why is this invoice being voided?"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-destructive placeholder:text-muted-foreground"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => { setShowVoidConfirm(false); setVoidReason(''); }}
                className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              {!hasPaidAmount && (
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
    </div>
  );
}
