import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { SignOutButton } from '../../SignOutButton';
import { OrderDetailsActionsClient } from './OrderDetailsActionsClient';
import {
  Building2,
  Users,
  Package,
  Boxes,
  UserCheck,
  ShoppingCart,
  DollarSign,
  BarChart3,
  ShieldAlert,
  LayoutDashboard,
  ShieldCheck,
  Lock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Ban,
  Check,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  FileText,
} from 'lucide-react';
import { OrderStatus } from '@prisma/client';

interface OrderDetailsPageProps {
  params: {
    orgSlug: string;
    orderId: string;
  };
}

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { orgSlug, orderId } = params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/orders/${orderId}`);
  }

  let tenantContext;
  let userTenants: Array<{ tenantId: string; tenantSlug: string; tenantName: string; role: string }> = [];

  try {
    tenantContext = await getRequiredTenantContext(orgSlug);
  } catch (error) {
    userTenants = await getUserTenants(session.user.id);

    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-lg space-y-6 rounded-xl border border-destructive/30 bg-card p-8 shadow-2xl">
          <div className="flex items-center space-x-3 text-destructive">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Access Denied (403 Forbidden)</h1>
              <p className="text-xs text-muted-foreground">Cross-tenant isolation enforced server-side</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
            <p>
              Your account (<strong className="text-foreground">{session.user.email}</strong>) is not an authorized member of <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary font-bold">{orgSlug}</code>.
            </p>
          </div>

          {userTenants.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Your Workspaces:
              </div>
              {userTenants.map((t) => (
                <Link
                  key={t.tenantId}
                  href={`/${t.tenantSlug}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:border-primary/50 text-xs"
                >
                  <span className="font-medium text-foreground">{t.tenantName}</span>
                  <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-mono text-[10px] uppercase">
                    {t.role}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Return Home
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const { tenantName, role, user, tenantId } = tenantContext;

  // Strict tenant scoping
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenantId,
    },
    include: {
      customer: true,
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              inventory: true,
              category: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Order Not Found</h1>
          <p className="text-xs text-muted-foreground">
            The requested order ID does not exist in workspace <strong className="text-foreground">{tenantName}</strong>.
          </p>
          <div className="pt-2">
            <Link
              href={`/${orgSlug}/orders`}
              className="inline-flex items-center space-x-1 text-xs text-primary hover:underline font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Orders Directory</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const modules = [
    { name: 'Dashboard', icon: LayoutDashboard, path: `/${orgSlug}`, active: false },
    { name: 'Users & Roles', icon: Users, path: `/${orgSlug}/users`, active: false },
    { name: 'Products & Inventory', icon: Package, path: `/${orgSlug}/products`, active: false },
    { name: 'Inventory History', icon: Boxes, path: `/${orgSlug}/products/inventory`, active: false },
    { name: 'Customers', icon: UserCheck, path: `/${orgSlug}/customers`, active: false },
    { name: 'Orders', icon: ShoppingCart, path: `/${orgSlug}/orders`, active: true },
    { name: 'Financial Management', icon: DollarSign, path: `/${orgSlug}/finance`, active: false },
    { name: 'Reports & Analytics', icon: BarChart3, path: `/${orgSlug}/reports`, active: false },
    { name: 'Audit Logs', icon: ShieldAlert, path: `/${orgSlug}/audit`, active: false },
  ];

  const roleColors: Record<string, string> = {
    OWNER: 'bg-primary/10 text-primary border-primary/30',
    ADMIN: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    MEMBER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    VIEWER: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DRAFT:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">
            <Clock className="mr-1.5 h-3.5 w-3.5" /> Draft
          </span>
        );
      case OrderStatus.CONFIRMED:
        return (
          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            <Check className="mr-1.5 h-3.5 w-3.5" /> Confirmed
          </span>
        );
      case OrderStatus.COMPLETED:
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Completed
          </span>
        );
      case OrderStatus.CANCELLED:
        return (
          <span className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-semibold text-destructive">
            <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancelled
          </span>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          {/* Brand & Active Organization */}
          <Link href={`/${orgSlug}`} className="flex items-center space-x-3 px-2 py-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
              N
            </div>
            <div>
              <div className="font-semibold text-sm">Nexora Suite</div>
              <div className="text-xs text-muted-foreground">Multi-Tenant Platform</div>
            </div>
          </Link>

          {/* Active Tenant Context */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Active Tenant
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-foreground truncate">{tenantName}</span>
              <Building2 className="h-4 w-4 text-primary shrink-0" />
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
              <Lock className="h-3 w-3" /> Server-side isolated ({orgSlug})
            </div>
          </div>

          {/* Module Navigation List */}
          <nav className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              Modules
            </div>
            {modules.map((mod) => {
              const Icon = mod.icon;
              return mod.active || mod.path !== '#' ? (
                <Link
                  key={mod.name}
                  href={mod.path}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                    mod.active
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-4 w-4" />
                    <span>{mod.name}</span>
                  </div>
                </Link>
              ) : (
                <div
                  key={mod.name}
                  className="flex items-center justify-between px-3 py-2 text-sm rounded-md text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-4 w-4" />
                    <span>{mod.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    Upcoming
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer User Profile & Role Info */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="text-xs font-semibold text-foreground truncate">{user.name || 'User'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono border ${
                roleColors[role] || 'bg-muted text-muted-foreground'
              }`}
            >
              {role}
            </span>
          </div>
          <div className="flex justify-end">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="border-b border-border bg-card px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <Link
              href={`/${orgSlug}/orders`}
              className="inline-flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground transition-colors mr-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Orders</span>
            </Link>
            <h1 className="text-lg font-semibold text-foreground">
              Order #{order.id.slice(-6).toUpperCase()}
            </h1>
            {getStatusBadge(order.status)}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Client-side action buttons: Cancel, Complete, Confirm */}
            <OrderDetailsActionsClient
              orgSlug={orgSlug}
              orderId={order.id}
              orderStatus={order.status}
              currentUserRole={role}
              orderShortId={order.id.slice(-6).toUpperCase()}
            />
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Switch Workspace
              </Link>
              <SignOutButton />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Order Header Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Information Card */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                <UserCheck className="h-4 w-4 text-primary" />
                <span>Customer Information</span>
              </div>
              <div>
                <div className="font-bold text-sm text-foreground">{order.customer.name}</div>
                {order.customer.companyName && (
                  <div className="text-xs text-muted-foreground flex items-center space-x-1 mt-0.5">
                    <Building className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>{order.customer.companyName}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border">
                {order.customer.email && (
                  <div className="flex items-center space-x-1.5">
                    <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{order.customer.email}</span>
                  </div>
                )}
                {order.customer.phone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{order.customer.phone}</span>
                  </div>
                )}
                {order.customer.city && (
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{[order.customer.city, order.customer.address].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Meta Card */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-primary" />
                <span>Order Timeline</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Date:</span>
                  <span className="font-medium text-foreground">
                    {new Date(order.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By:</span>
                  <span className="font-medium text-foreground">
                    {order.createdByUser?.name || order.createdByUser?.email || 'System'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span>{order.status}</span>
                </div>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>Financial Overview</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">${parseFloat(order.subtotal.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount:</span>
                  <span className="font-mono font-medium">-${parseFloat(order.discount.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-foreground font-bold text-base pt-1.5 border-t border-border">
                  <span>Total Amount:</span>
                  <span className="font-mono text-primary">${parseFloat(order.total.toString()).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/40 font-semibold text-xs text-foreground uppercase tracking-wider">
              Ordered Products ({order.items.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Product / SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-center">Quantity</th>
                    <th className="px-4 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{item.product.name}</div>
                        <div className="text-[11px] font-mono text-primary">{item.product.sku}</div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {item.product.category?.name || 'Uncategorized'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        ${parseFloat(item.unitPrice.toString()).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                        ${parseFloat(item.lineTotal.toString()).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes Section if available */}
          {order.notes && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-1 text-xs">
              <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Order Notes & Handling
              </div>
              <p className="text-foreground whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
