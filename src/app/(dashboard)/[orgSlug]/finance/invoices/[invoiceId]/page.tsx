import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { canViewFinance } from '@/lib/auth/finance-auth';
import { prisma } from '@/lib/db/prisma';
import { SignOutButton } from '../../../SignOutButton';
import { InvoiceDetailActionsClient } from './InvoiceDetailActionsClient';
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
  FileText,
  AlertCircle,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  CreditCard,
  Calendar,
  Hash,
  ExternalLink,
  Receipt,
  CheckCircle2,
  Clock,
  Ban,
  Send,
  Wallet,
} from 'lucide-react';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';

interface InvoiceDetailPageProps {
  params: {
    orgSlug: string;
    invoiceId: string;
  };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; cls: string }> = {
    DRAFT:          { label: 'Draft',           cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
    ISSUED:         { label: 'Issued',           cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    PARTIALLY_PAID: { label: 'Partially Paid',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    OVERDUE:        { label: 'Overdue',          cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    PAID:           { label: 'Paid',             cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    VOIDED:         { label: 'Voided',           cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  };
  const cfg = map[status] || map.DRAFT;
  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Payment Method Label ─────────────────────────────────────────────────────

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    BANK_TRANSFER: 'Bank Transfer',
    CREDIT_CARD: 'Credit Card',
    DEBIT_CARD: 'Debit Card',
    CASH: 'Cash',
    CHECK: 'Check',
    PAYPAL: 'PayPal',
    STRIPE: 'Stripe',
    OTHER: 'Other',
  };
  return map[method] || method;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { orgSlug, invoiceId } = params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/finance/invoices/${invoiceId}`);
  }

  // Tenant context resolution (cross-tenant returns 403)
  let tenantContext;
  let userTenants: Array<{ tenantId: string; tenantSlug: string; tenantName: string; role: string }> = [];

  try {
    tenantContext = await getRequiredTenantContext(orgSlug);
  } catch {
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
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <p>
              Your account (<strong className="text-foreground">{session.user.email}</strong>) is not a member of{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary font-bold">{orgSlug}</code>.
            </p>
          </div>
          {userTenants.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">Your Workspaces:</div>
              {userTenants.map((t) => (
                <Link
                  key={t.tenantId}
                  href={`/${t.tenantSlug}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:border-primary/50 text-xs"
                >
                  <span className="font-medium text-foreground">{t.tenantName}</span>
                  <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-mono text-[10px] uppercase">{t.role}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Return Home</Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const { tenantId, tenantName, role, user } = tenantContext;

  // RBAC
  if (!canViewFinance(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card p-6 shadow-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground">
            Your role (<span className="font-semibold text-foreground">{role}</span>) cannot view invoices.
          </p>
          <Link href={`/${orgSlug}`} className="inline-flex items-center text-xs font-medium text-primary hover:underline">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── Load invoice (must belong to this tenant) ────────────────────────────
  const rawInvoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyName: true,
          address: true,
          city: true,
        },
      },
      order: {
        select: { id: true, status: true, total: true },
      },
      createdByUser: {
        select: { name: true, email: true },
      },
      items: {
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        include: {
          createdByUser: { select: { name: true, email: true } },
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  if (!rawInvoice) {
    notFound();
  }

  // After notFound() guard, TypeScript needs an explicit assertion
  const invoice = rawInvoice!;

  // ─── Derived values ───────────────────────────────────────────────────────
  const subtotal = parseFloat(invoice.subtotal.toString());
  const discount = parseFloat(invoice.discount.toString());
  const taxAmount = parseFloat(invoice.taxAmount.toString());
  const taxRate = parseFloat(invoice.taxRate.toString());
  const total = parseFloat(invoice.total.toString());
  const paidAmount = parseFloat(invoice.paidAmount.toString());
  const balance = parseFloat(invoice.balance.toString());

  const isTerminal = invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOIDED;
  const orderRef = invoice.orderId ? `ORD-${invoice.orderId.slice(-6).toUpperCase()}` : null;

  // ─── Navigation ───────────────────────────────────────────────────────────
  const navModules = [
    { name: 'Dashboard', icon: LayoutDashboard, path: `/${orgSlug}`, active: false },
    { name: 'Users & Roles', icon: Users, path: `/${orgSlug}/users`, active: false },
    { name: 'Products & Inventory', icon: Package, path: `/${orgSlug}/products`, active: false },
    { name: 'Inventory History', icon: Boxes, path: `/${orgSlug}/products/inventory`, active: false },
    { name: 'Customers', icon: UserCheck, path: `/${orgSlug}/customers`, active: false },
    { name: 'Orders', icon: ShoppingCart, path: `/${orgSlug}/orders`, active: false },
    { name: 'Financial Management', icon: DollarSign, path: `/${orgSlug}/finance`, active: true },
    { name: 'Reports & Analytics', icon: BarChart3, path: `/${orgSlug}/reports`, active: false },
    { name: 'Audit Logs', icon: ShieldAlert, path: `/${orgSlug}/audit`, active: false },
  ];

  const roleColors: Record<string, string> = {
    OWNER: 'bg-primary/10 text-primary border-primary/30',
    ADMIN: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    MEMBER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    VIEWER: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          <Link href={`/${orgSlug}`} className="flex items-center space-x-3 px-2 py-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
              N
            </div>
            <div>
              <div className="font-semibold text-sm">Nexora Suite</div>
              <div className="text-xs text-muted-foreground">Financial Platform</div>
            </div>
          </Link>

          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Active Workspace</div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-foreground truncate">{tenantName}</span>
              <Building2 className="h-4 w-4 text-primary shrink-0" />
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
              <Lock className="h-3 w-3" /> Server-side isolated ({orgSlug})
            </div>
          </div>

          {/* Finance Sub-Nav */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">Finance</div>
            {[
              { name: 'Overview', path: `/${orgSlug}/finance` },
              { name: 'Invoices', path: `/${orgSlug}/finance/invoices` },
              { name: 'Payments', path: `/${orgSlug}/finance/payments` },
              { name: 'Expenses', path: `/${orgSlug}/finance/expenses` },
              { name: 'General Ledger', path: `/${orgSlug}/finance/ledger` },
              { name: 'Receivables', path: `/${orgSlug}/finance/receivables` },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.path}
                className="flex items-center space-x-2.5 px-3 py-2 text-xs rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          <nav className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">All Modules</div>
            {navModules.map((module) => {
              const Icon = module.icon;
              return module.active || module.path !== '#' ? (
                <Link
                  key={module.name}
                  href={module.path}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                    module.active
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-4 w-4" />
                    <span>{module.name}</span>
                  </div>
                </Link>
              ) : (
                <div
                  key={module.name}
                  className="flex items-center justify-between px-3 py-2 text-sm rounded-md text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-4 w-4" />
                    <span>{module.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    Upcoming
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="text-xs font-semibold text-foreground truncate">{user.name || 'User'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono border shrink-0 ${roleColors[role] || 'bg-muted text-muted-foreground'}`}>
              {role}
            </span>
          </div>
          <div className="flex justify-end">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <Link
              href={`/${orgSlug}/finance/invoices`}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Back to Invoices"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground font-mono">{invoice.invoiceNumber}</h1>
              <p className="text-xs text-muted-foreground">Invoice Detail</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={invoice.status} />
            <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Tenant Isolated
            </span>
            <SignOutButton />
          </div>
        </header>

        {/* Content */}
        <main className="p-6 flex-1 overflow-y-auto space-y-6">

          {/* State Banner (Terminal States) */}
          {invoice.status === InvoiceStatus.VOIDED && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center space-x-3">
              <Ban className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <div className="text-sm font-semibold text-destructive">Invoice Voided</div>
                <div className="text-xs text-muted-foreground">This invoice has been cancelled and is no longer valid. Preserved for audit purposes.</div>
              </div>
            </div>
          )}

          {invoice.status === InvoiceStatus.PAID && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-400">Invoice Fully Paid</div>
                <div className="text-xs text-muted-foreground">Payment has been received in full. This invoice is closed.</div>
              </div>
            </div>
          )}

          {invoice.status === InvoiceStatus.OVERDUE && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-rose-400">Invoice Overdue</div>
                <div className="text-xs text-muted-foreground">
                  Due date was {invoice.dueDate.toLocaleDateString()}. Balance outstanding: ${balance.toFixed(2)}.
                </div>
              </div>
            </div>
          )}

          {/* Actions (Client Component) */}
          {!isTerminal && (
            <InvoiceDetailActionsClient
              orgSlug={orgSlug}
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              status={invoice.status}
              paidAmount={invoice.paidAmount.toString()}
              currentUserRole={role}
            />
          )}

          {/* Main Invoice Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Invoice Header Banner */}
            <div className="p-6 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold font-mono text-foreground">{invoice.invoiceNumber}</h2>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created by {invoice.createdByUser?.name || invoice.createdByUser?.email || 'System'} on{' '}
                    {invoice.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* Customer + Order Info Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Bill To</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
                    <div className="font-semibold text-foreground">{invoice.customer.name}</div>
                    {invoice.customer.companyName && (
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Building className="h-3.5 w-3.5 shrink-0" />
                        <span>{invoice.customer.companyName}</span>
                      </div>
                    )}
                    {invoice.customer.email && (
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span>{invoice.customer.email}</span>
                      </div>
                    )}
                    {invoice.customer.phone && (
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{invoice.customer.phone}</span>
                      </div>
                    )}
                    {invoice.customer.address && (
                      <div className="flex items-start space-x-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {invoice.customer.address}
                          {invoice.customer.city && `, ${invoice.customer.city}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice Metadata */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span>Invoice Details</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice Number</span>
                      <span className="font-mono font-bold text-foreground">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Issue Date</span>
                      <span className="text-foreground">{invoice.issueDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`flex items-center gap-1 ${invoice.status === InvoiceStatus.OVERDUE ? 'text-rose-400' : 'text-muted-foreground'}`}>
                        <Calendar className="h-3 w-3" /> Due Date
                      </span>
                      <span className={invoice.status === InvoiceStatus.OVERDUE ? 'text-rose-400 font-semibold' : 'text-foreground'}>
                        {invoice.dueDate.toLocaleDateString()}
                      </span>
                    </div>
                    {orderRef && invoice.orderId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Linked Order</span>
                        <Link
                          href={`/${orgSlug}/orders/${invoice.orderId}`}
                          className="font-mono text-primary hover:underline flex items-center gap-1"
                        >
                          {orderRef}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created By</span>
                      <span className="text-foreground">{invoice.createdByUser?.name || invoice.createdByUser?.email || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Line Items</span>
                  <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                    {invoice.items.length} {invoice.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invoice.items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-foreground">{item.description}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.product ? (
                              <span className="font-mono text-[11px]">
                                {item.product.name}
                                {item.product.sku ? ` (${item.product.sku})` : ''}
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground/50">No product</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono">${parseFloat(item.unitPrice.toString()).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                            ${parseFloat(item.lineTotal.toString()).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2 rounded-xl border border-border bg-muted/20 p-5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-xs text-amber-400">
                      <span>Discount</span>
                      <span className="font-mono">−${discount.toFixed(2)}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tax ({taxRate.toFixed(2)}%)</span>
                      <span className="font-mono">${taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2 mt-1">
                    <span>Total</span>
                    <span className="font-mono">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-400">
                    <span>Paid Amount</span>
                    <span className="font-mono">${paidAmount.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-bold border-t border-border pt-2 mt-1 ${balance > 0 ? (invoice.status === InvoiceStatus.OVERDUE ? 'text-rose-400' : 'text-amber-400') : 'text-emerald-400'}`}>
                    <span>Outstanding Balance</span>
                    <span className="font-mono">${balance.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {(invoice.notes || invoice.terms) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
                  {invoice.notes && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
                      <div className="rounded-lg border border-border bg-muted/10 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
                        {invoice.notes}
                      </div>
                    </div>
                  )}
                  {invoice.terms && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terms & Conditions</div>
                      <div className="rounded-lg border border-border bg-muted/10 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
                        {invoice.terms}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                    {invoice.payments.length} payment{invoice.payments.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ${paidAmount.toFixed(2)} collected of ${total.toFixed(2)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Payment #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Recorded By</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.payments.map((payment) => {
                      const isRefunded = payment.status === PaymentStatus.REFUNDED;
                      return (
                        <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] font-semibold text-foreground">
                            {payment.paymentNumber}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {payment.paymentDate.toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {paymentMethodLabel(payment.paymentMethod)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                            {payment.reference || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {payment.createdByUser?.name || payment.createdByUser?.email || 'System'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              isRefunded
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {isRefunded ? 'Refunded' : 'Completed'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${isRefunded ? 'text-amber-400 line-through' : 'text-emerald-400'}`}>
                            ${parseFloat(payment.amount.toString()).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No payments yet placeholder */}
          {invoice.payments.length === 0 && invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.VOIDED && (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground">No payments recorded yet</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Payments will appear here once recorded against this invoice through the Payments module.
              </p>
            </div>
          )}

          {/* Back Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Link
              href={`/${orgSlug}/finance/invoices`}
              className="inline-flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Invoices</span>
            </Link>
            <Link
              href={`/${orgSlug}/finance`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Financial Overview →
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
