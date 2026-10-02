'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, OrderStatus } from '@prisma/client';
import { Ban, CheckCircle2, Loader2, AlertTriangle, X, Check } from 'lucide-react';
import {
  cancelOrderAction,
  completeOrderAction,
  confirmOrderAction,
} from '@/lib/actions/orders';
import {
  canCancelOrder,
  canCompleteOrder,
  canConfirmOrder,
} from '@/lib/auth/order-auth';

interface OrderDetailsActionsClientProps {
  orgSlug: string;
  orderId: string;
  orderStatus: OrderStatus;
  currentUserRole: Role;
  orderShortId: string;
}

export function OrderDetailsActionsClient({
  orgSlug,
  orderId,
  orderStatus,
  currentUserRole,
  orderShortId,
}: OrderDetailsActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const cancelDecision = canCancelOrder(currentUserRole);
  const completeDecision = canCompleteOrder(currentUserRole);
  const confirmDecision = canConfirmOrder(currentUserRole);

  const showCancelAction =
    orderStatus === OrderStatus.DRAFT || orderStatus === OrderStatus.CONFIRMED;
  const showCompleteAction = orderStatus === OrderStatus.CONFIRMED;
  const showConfirmAction = orderStatus === OrderStatus.DRAFT;

  const isConfirmedCancellation = orderStatus === OrderStatus.CONFIRMED;

  const handleCancelOrder = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await cancelOrderAction(orgSlug, {
        orderId,
        reason: cancelReason.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Order cancelled.' });
        setIsCancelModalOpen(false);
        setCancelReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to cancel order.' });
        setIsCancelModalOpen(false);
      }
    });
  };

  const handleCompleteOrder = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await completeOrderAction(orgSlug, { orderId });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Order marked as completed.' });
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to complete order.' });
      }
    });
  };

  const handleConfirmOrder = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await confirmOrderAction(orgSlug, { orderId });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Order confirmed and inventory deducted.' });
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to confirm order.' });
      }
    });
  };

  // No actions available for terminal states
  if (orderStatus === OrderStatus.COMPLETED || orderStatus === OrderStatus.CANCELLED) {
    return null;
  }

  return (
    <>
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <span className="font-medium">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Confirm (DRAFT → CONFIRMED) */}
        {showConfirmAction && (
          <button
            id="confirm-order-btn"
            type="button"
            onClick={handleConfirmOrder}
            disabled={!confirmDecision.allowed || isPending}
            title={!confirmDecision.allowed ? (confirmDecision.reason ?? 'Restricted') : 'Confirm order and deduct inventory'}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              confirmDecision.allowed
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Confirm Order</span>
          </button>
        )}

        {/* Complete (CONFIRMED → COMPLETED) */}
        {showCompleteAction && (
          <button
            id="complete-order-btn"
            type="button"
            onClick={handleCompleteOrder}
            disabled={!completeDecision.allowed || isPending}
            title={!completeDecision.allowed ? (completeDecision.reason ?? 'Restricted') : 'Mark order as completed'}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              completeDecision.allowed
                ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            <span>Mark Completed</span>
          </button>
        )}

        {/* Cancel (DRAFT or CONFIRMED) */}
        {showCancelAction && (
          <button
            id="cancel-order-btn"
            type="button"
            onClick={() => {
              setCancelReason('');
              setFeedback(null);
              setIsCancelModalOpen(true);
            }}
            disabled={!cancelDecision.allowed || isPending}
            title={!cancelDecision.allowed ? (cancelDecision.reason ?? 'Restricted') : 'Cancel this order'}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md border text-xs font-medium transition-colors ${
              cancelDecision.allowed
                ? 'border-destructive/50 text-destructive hover:bg-destructive/10'
                : 'border-border text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            <Ban className="h-3.5 w-3.5" />
            <span>Cancel Order</span>
          </button>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20 shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Cancel Order #{orderShortId}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {isConfirmedCancellation
                    ? 'This is a CONFIRMED order. Cancellation will atomically restore inventory for all line items and create STOCK_IN movements.'
                    : 'This DRAFT order will be cancelled. No inventory changes are required.'}
                </p>
              </div>
            </div>

            {isConfirmedCancellation && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Inventory Restoration</span>
                </div>
                <p>
                  All deducted stock from this confirmed order will be atomically restored and a STOCK_IN movement will be recorded for each product.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Cancellation Reason (Optional)
              </label>
              <input
                id="cancel-reason-input"
                type="text"
                maxLength={250}
                placeholder="e.g. Customer requested, Duplicate order, Out of stock"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isPending}
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Keep Order
              </button>
              <button
                id="confirm-cancel-btn"
                type="button"
                onClick={handleCancelOrder}
                disabled={isPending}
                className="inline-flex items-center space-x-1.5 rounded-md bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
