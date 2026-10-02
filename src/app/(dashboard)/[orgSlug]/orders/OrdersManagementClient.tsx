'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role, OrderStatus } from '@prisma/client';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Check,
  Ban,
  Clock,
  Eye,
  Trash2,
  Building,
  Lock,
} from 'lucide-react';
import {
  createOrderAction,
  confirmOrderAction,
  cancelOrderAction,
  completeOrderAction,
} from '@/lib/actions/orders';
import {
  canCreateOrder,
  canConfirmOrder,
  canCancelOrder,
  canCompleteOrder,
} from '@/lib/auth/order-auth';

export interface SerializedOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface SerializedOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerCompany: string | null;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  total: string;
  notes: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  items: SerializedOrderItem[];
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
}

export interface CustomerOption {
  id: string;
  name: string;
  companyName: string | null;
}

export interface LineItemDraft {
  id: string;
  productId: string;
  quantity: number;
}

interface OrdersManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  orders: SerializedOrder[];
  products: ProductOption[];
  customers: CustomerOption[];
}

export function OrdersManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  orders,
  products,
  customers,
}: OrdersManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Create Order Form State with unique IDs for stable keys
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderDiscount, setOrderDiscount] = useState('0.00');
  const [orderNotes, setOrderNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { id: 'item_1', productId: products[0]?.id || '', quantity: 1 },
  ]);

  // Permissions
  const canCreate = canCreateOrder(currentUserRole).allowed;
  const canConfirm = canConfirmOrder(currentUserRole).allowed;
  const canCancel = canCancelOrder(currentUserRole).allowed;
  const canComplete = canCompleteOrder(currentUserRole).allowed;

  // Filtered Orders
  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      order.id.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      (order.customerCompany?.toLowerCase().includes(query) ?? false) ||
      order.items.some(
        (i) =>
          i.productName.toLowerCase().includes(query) ||
          i.productSku.toLowerCase().includes(query)
      );

    const matchesStatus =
      statusFilter === 'ALL' ||
      order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Metrics
  const metrics = {
    total: orders.length,
    draft: orders.filter((o) => o.status === OrderStatus.DRAFT).length,
    confirmed: orders.filter((o) => o.status === OrderStatus.CONFIRMED).length,
    completed: orders.filter((o) => o.status === OrderStatus.COMPLETED).length,
    cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
    totalRevenue: orders
      .filter((o) => o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.COMPLETED)
      .reduce((acc, o) => acc + parseFloat(o.total), 0),
  };

  // Dynamic Line Item Calculation Helpers for Create Modal
  const productMap = new Map(products.map((p) => [p.id, p]));

  const calculateDraftSubtotal = () => {
    return lineItems.reduce((acc, item) => {
      const prod = productMap.get(item.productId);
      const price = prod ? parseFloat(prod.price) : 0;
      return acc + price * (item.quantity || 0);
    }, 0);
  };

  const draftSubtotal = calculateDraftSubtotal();
  const draftDiscount = parseFloat(orderDiscount) || 0;
  const draftTotal = Math.max(0, draftSubtotal - draftDiscount);

  // Line Item Handlers — using functional updates and stable unique keys
  const handleAddLineItem = () => {
    const nextProd = products.find((p) => !lineItems.some((li) => li.productId === p.id)) || products[0];
    const newId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const prodId = nextProd?.id || products[0]?.id || '';

    setLineItems((prev) => [
      ...prev,
      { id: newId, productId: prodId, quantity: 1 },
    ]);
  };

  const handleRemoveLineItem = (idToRemove: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== idToRemove);
    });
  };

  const handleLineItemChange = (id: string, field: 'productId' | 'quantity', value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'productId') {
          return { ...item, productId: value };
        } else if (field === 'quantity') {
          return { ...item, quantity: Math.max(1, parseInt(value, 10) || 1) };
        }
        return item;
      })
    );
  };

  // Actions
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedCustomerId) {
      setFeedback({ type: 'error', message: 'Please select a customer.' });
      return;
    }

    if (lineItems.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one line item.' });
      return;
    }

    startTransition(async () => {
      const res = await createOrderAction(orgSlug, {
        customerId: selectedCustomerId,
        discount: parseFloat(orderDiscount) || 0,
        notes: orderNotes.trim() || undefined,
        items: lineItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
        })),
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Order drafted successfully.' });
        setIsCreateModalOpen(false);
        setSelectedCustomerId('');
        setOrderDiscount('0.00');
        setOrderNotes('');
        setLineItems([{ id: 'item_1', productId: products[0]?.id || '', quantity: 1 }]);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create order.' });
      }
    });
  };

  const handleConfirmOrder = async (orderId: string) => {
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

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await cancelOrderAction(orgSlug, {
        orderId: cancellingOrderId,
        reason: cancelReason.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Order cancelled.' });
        setCancellingOrderId(null);
        setCancelReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to cancel order.' });
      }
    });
  };

  const handleCompleteOrder = async (orderId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await completeOrderAction(orgSlug, { orderId });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Order completed.' });
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to complete order.' });
      }
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DRAFT:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
            <Clock className="mr-1 h-3 w-3" /> Draft
          </span>
        );
      case OrderStatus.CONFIRMED:
        return (
          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            <Check className="mr-1 h-3 w-3" /> Confirmed
          </span>
        );
      case OrderStatus.COMPLETED:
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
          </span>
        );
      case OrderStatus.CANCELLED:
        return (
          <span className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-0.5 text-[10px] font-semibold text-destructive">
            <Ban className="mr-1 h-3 w-3" /> Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center space-x-2.5 text-xs font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders & Fulfillment</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {metrics.total} {metrics.total === 1 ? 'Order' : 'Orders'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Create multi-item orders, fulfill inventory on confirmation, and track client purchases for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate ? (
            <button
              id="create-order-btn"
              type="button"
              onClick={() => {
                setFeedback(null);
                setLineItems([{ id: 'item_1', productId: products[0]?.id || '', quantity: 1 }]);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Order</span>
            </button>
          ) : (
            <div
              title="Only Authorized roles can create orders"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Create Order (Restricted)</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Orders
          </div>
          <div className="text-xl font-bold text-foreground">{metrics.total}</div>
          <div className="text-[10px] text-muted-foreground">All logged orders</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Drafts
          </div>
          <div className="text-xl font-bold text-amber-400">{metrics.draft}</div>
          <div className="text-[10px] text-muted-foreground">No stock reserved</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Confirmed
          </div>
          <div className="text-xl font-bold text-primary">{metrics.confirmed}</div>
          <div className="text-[10px] text-muted-foreground">Inventory deducted</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Completed
          </div>
          <div className="text-xl font-bold text-emerald-400">{metrics.completed}</div>
          <div className="text-[10px] text-muted-foreground">Fulfilled & closed</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Volume
          </div>
          <div className="text-xl font-bold text-emerald-400" suppressHydrationWarning>
            ${metrics.totalRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">Confirmed & Completed</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID, customer, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value={OrderStatus.DRAFT}>Draft</option>
            <option value={OrderStatus.CONFIRMED}>Confirmed</option>
            <option value={OrderStatus.COMPLETED}>Completed</option>
            <option value={OrderStatus.CANCELLED}>Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order ID / Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items Summary</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-xs">No orders found.</p>
                      <p className="text-[11px] text-muted-foreground/75">
                        Create a draft order to begin fulfillment tracking.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const shortId = order.id.slice(-6).toUpperCase();
                  const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0);

                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      {/* Order ID & Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/${orgSlug}/orders/${order.id}`}
                          className="font-mono font-bold text-primary hover:underline flex items-center space-x-1"
                        >
                          <span>#{shortId}</span>
                        </Link>
                        <div className="text-[11px] text-muted-foreground mt-0.5" suppressHydrationWarning>
                          {order.createdAt.split('T')[0]}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{order.customerName}</div>
                        {order.customerCompany ? (
                          <div className="text-[11px] text-muted-foreground flex items-center space-x-1">
                            <Building className="h-3 w-3 shrink-0" />
                            <span>{order.customerCompany}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/60 italic">Direct Client</div>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">
                          {itemCount} {itemCount === 1 ? 'unit' : 'units'} ({order.items.length}{' '}
                          {order.items.length === 1 ? 'item' : 'items'})
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                          {order.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-sm text-foreground">
                          ${parseFloat(order.total).toFixed(2)}
                        </div>
                        {parseFloat(order.discount) > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            Sub: ${parseFloat(order.subtotal).toFixed(2)} (-${parseFloat(order.discount).toFixed(2)})
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">{getStatusBadge(order.status)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* View Details */}
                          <Link
                            href={`/${orgSlug}/orders/${order.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="View Full Order Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {/* Confirm Action (DRAFT only) */}
                          {order.status === OrderStatus.DRAFT && (
                            <button
                              onClick={() => handleConfirmOrder(order.id)}
                              disabled={!canConfirm || isPending}
                              title={
                                !canConfirm
                                  ? 'Admin or Owner only'
                                  : 'Confirm Order & Deduct Inventory'
                              }
                              className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                canConfirm
                                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                  : 'text-muted-foreground/30 cursor-not-allowed'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Confirm</span>
                            </button>
                          )}

                          {/* Complete Action (CONFIRMED only) */}
                          {order.status === OrderStatus.CONFIRMED && (
                            <button
                              onClick={() => handleCompleteOrder(order.id)}
                              disabled={!canComplete || isPending}
                              title={!canComplete ? 'Admin or Owner only' : 'Mark as Completed'}
                              className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                canComplete
                                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'text-muted-foreground/30 cursor-not-allowed'
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Complete</span>
                            </button>
                          )}

                          {/* Cancel Action (DRAFT or CONFIRMED) */}
                          {(order.status === OrderStatus.DRAFT ||
                            order.status === OrderStatus.CONFIRMED) && (
                            <button
                              onClick={() => {
                                setCancellingOrderId(order.id);
                                setCancelReason('');
                                setFeedback(null);
                              }}
                              disabled={!canCancel || isPending}
                              title={!canCancel ? 'Admin or Owner only' : 'Cancel Order'}
                              className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                canCancel
                                  ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                  : 'text-muted-foreground/30 cursor-not-allowed'
                              }`}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span>Cancel</span>
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
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CREATE ORDER */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Create New Order (Draft)</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Customer Selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Select Customer *
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Order Items
                  </div>
                  <button
                    id="add-item-btn"
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center space-x-1 text-xs text-primary hover:underline font-medium cursor-pointer p-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item) => {
                    const prod = productMap.get(item.productId);
                    const linePrice = prod ? parseFloat(prod.price) : 0;
                    const lineTotal = linePrice * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/20"
                      >
                        {/* Product Dropdown */}
                        <div className="flex-1">
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              handleLineItemChange(item.id, 'productId', e.target.value)
                            }
                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {products.length === 0 ? (
                              <option value="">No products available in workspace</option>
                            ) : (
                              products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} [{p.sku}] - ${parseFloat(p.price).toFixed(2)} (Stock: {p.stock})
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleLineItemChange(item.id, 'quantity', e.target.value)
                            }
                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-24 text-right font-mono font-bold text-xs text-foreground pr-2">
                          ${lineTotal.toFixed(2)}
                        </div>

                        {/* Delete Button */}
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Remove Line Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discount & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Order Discount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Shipping instructions, PO references, special handling"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Live Totals Box */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">${draftSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount:</span>
                  <span className="font-mono font-medium">-${draftDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-foreground font-bold text-sm pt-1 border-t border-border">
                  <span>Calculated Total:</span>
                  <span className="font-mono text-primary">${draftTotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/75 pt-1">
                  Note: The server will verify all stock and recalculate live prices from current database records.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <span>Create Draft Order</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CANCEL ORDER CONFIRMATION */}
      {/* ========================================================= */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Cancel Order</h2>
                <p className="text-[11px] text-muted-foreground">
                  Order #{cancellingOrderId.slice(-6).toUpperCase()}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                Are you sure you want to cancel this order? If the order was already confirmed, reserved inventory will be automatically restored to the warehouse.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Reason for Cancellation</label>
              <input
                type="text"
                placeholder="e.g. Customer requested cancellation, Duplicate order"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setCancellingOrderId(null)}
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Keep Order
              </button>
              <button
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
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
