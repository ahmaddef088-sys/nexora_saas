import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { canViewFinance } from '@/lib/auth/finance-auth';
import { prisma } from '@/lib/db/prisma';
import { SignOutButton } from '../../../SignOutButton';
import { PaymentDetailActionsClient } from './PaymentDetailActionsClient';
import { paymentMethodLabels } from '@/lib/utils/payment-constants';
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
  CreditCard,
  AlertCircle,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Hash,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Receipt,
} from 'lucide-react';
import { PaymentStatus, LedgerEntryType } from '@prisma/client';

interface PaymentDetailPageProps {
  params: {
    orgSlug: string;
    paymentId: string;
  };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </span>
      );
    case PaymentStatus.REFUNDED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">
          <RotateCcw className="h-4 w-4" />
          Refunded
        </span>
      );
    case PaymentStatus.FAILED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-sm font-semibold text-rose-400">
          <AlertCircle className="h-4 w-4" />
          Failed
        </span>
      );
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const { orgSlug, paymentId } = params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/finance/payments/${paymentId}`);
  }

  // Tenant context resolution
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

  // RBAC Check
  if (!canViewFinance(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card p-6 shadow-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground">
            Your role (<span className="font-semibold text-foreground">{role}</span>) cannot view Payments.
          </p>
          <Link href={`/${orgSlug}`} className="inline-flex items-center text-xs font-medium text-primary hover:underline">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── Query Payment with Tenant Scoping ──────────────────────────────────────
  const rawPayment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      invoice: {
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
        },
      },
      createdByUser: {
        select: { name: true, email: true },
      },
      ledgerEntries: {
        include: {
          createdByUser: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!rawPayment) {
    notFound();
  }

  const payment = rawPayment!;
  const amount = parseFloat(payment.amount.toString());
  const isRefunded = payment.status === PaymentStatus.REFUNDED;

  // ─── Sidebar Navigation ────────────────────────────────────────────────────
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
                <CreditCard className="h-3.5 w-3.5" />
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <Link
              href={`/${orgSlug}/finance/payments`}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Back to Payments"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground font-mono">{payment.paymentNumber}</h1>
              <p className="text-xs text-muted-foreground">Payment Receipt & Transaction Detail</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={payment.status} />
            <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Tenant Isolated
            </span>
            <SignOutButton />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 flex-1 overflow-y-auto space-y-6">

          {/* Refunded Banner */}
          {isRefunded && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center space-x-3">
              <RotateCcw className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-400">Payment Refunded / Reversed</div>
                <div className="text-xs text-muted-foreground">
                  This transaction has been refunded. An offsetting negative ledger entry was created, and the balance on Invoice{' '}
                  <span className="font-mono font-medium text-foreground">{payment.invoice.invoiceNumber}</span> was restored.
                </div>
              </div>
            </div>
          )}

          {/* Action Client (Refund button for Owner) */}
          <PaymentDetailActionsClient
            orgSlug={orgSlug}
            paymentId={payment.id}
            paymentNumber={payment.paymentNumber}
            amount={payment.amount.toString()}
            status={payment.status}
            invoiceNumber={payment.invoice.invoiceNumber}
            currentUserRole={role}
          />

          {/* Main Payment Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Column 1 & 2: Payment & Invoice Info */}
            <div className="lg:col-span-2 space-y-6">

              {/* Payment Summary Card */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Payment Summary</h2>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-baseline justify-between border-b border-border pb-4">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase font-semibold">Payment Amount</div>
                      <div className={`text-3xl font-bold font-mono ${isRefunded ? 'text-amber-400 line-through' : 'text-emerald-400'}`}>
                        ${amount.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground uppercase font-semibold">Method</div>
                      <div className="text-sm font-medium text-foreground">
                        {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Transaction Number
                      </span>
                      <span className="font-mono font-bold text-foreground">{payment.paymentNumber}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Payment Date
                      </span>
                      <span className="text-foreground">{payment.paymentDate.toLocaleDateString()}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3" /> Reference / Check #
                      </span>
                      <span className="font-mono text-foreground">{payment.reference || '—'}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Recorded By
                      </span>
                      <span className="text-foreground">
                        {payment.createdByUser?.name || payment.createdByUser?.email || 'System'}
                      </span>
                    </div>
                  </div>

                  {payment.notes && (
                    <div className="space-y-1 border-t border-border pt-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Payment Notes
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                        {payment.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ledger Activity Double-Entry Audit Log */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Ledger Transactions</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Immutable journal entries</span>
                </div>

                {payment.ledgerEntries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No ledger records linked to this payment.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border text-muted-foreground bg-muted/20 text-[10px] uppercase font-semibold">
                        <tr>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Recorded By</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {payment.ledgerEntries.map((entry) => {
                          const isRevenue = entry.type === LedgerEntryType.REVENUE;
                          const decAmount = parseFloat(entry.amount.toString());
                          const isNegative = decAmount < 0;

                          return (
                            <tr key={entry.id} className="hover:bg-muted/10">
                              <td className="py-2.5 px-3 font-mono">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    isRevenue
                                      ? isNegative
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  }`}
                                >
                                  {isNegative ? 'REFUND' : entry.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-foreground">{entry.description}</td>
                              <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                                {new Date(entry.entryDate).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {entry.createdByUser?.name || entry.createdByUser?.email || 'System'}
                              </td>
                              <td
                                className={`py-2.5 px-3 font-semibold text-right font-mono ${
                                  isNegative ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {isNegative ? '-' : '+'}${Math.abs(decAmount).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Associated Invoice Card */}
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Associated Invoice</h3>
                  </div>
                  <Link
                    href={`/${orgSlug}/finance/invoices/${payment.invoice.id}`}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    View Invoice <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice #</span>
                    <span className="font-mono font-bold text-foreground">{payment.invoice.invoiceNumber}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-primary">{payment.invoice.status}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Total</span>
                    <span className="font-mono font-semibold text-foreground">
                      ${parseFloat(payment.invoice.total.toString()).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      ${parseFloat(payment.invoice.paidAmount.toString()).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground font-medium">Remaining Balance</span>
                    <span className="font-mono font-bold text-amber-400">
                      ${parseFloat(payment.invoice.balance.toString()).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2 text-xs border-t border-border">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Customer Details
                  </div>
                  <div className="font-semibold text-foreground">{payment.invoice.customer.name}</div>
                  {payment.invoice.customer.companyName && (
                    <div className="flex items-center space-x-1.5 text-muted-foreground">
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span>{payment.invoice.customer.companyName}</span>
                    </div>
                  )}
                  {payment.invoice.customer.email && (
                    <div className="flex items-center space-x-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span>{payment.invoice.customer.email}</span>
                    </div>
                  )}
                  {payment.invoice.customer.phone && (
                    <div className="flex items-center space-x-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{payment.invoice.customer.phone}</span>
                    </div>
                  )}
                  {payment.invoice.customer.address && (
                    <div className="flex items-start space-x-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        {payment.invoice.customer.address}
                        {payment.invoice.customer.city && `, ${payment.invoice.customer.city}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Link
              href={`/${orgSlug}/finance/payments`}
              className="inline-flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Payments</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                href={`/${orgSlug}/finance/invoices/${payment.invoice.id}`}
                className="text-xs text-primary hover:underline transition-colors"
              >
                Go to Invoice {payment.invoice.invoiceNumber} →
              </Link>
              <Link
                href={`/${orgSlug}/finance`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Financial Overview →
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
