import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { canViewFinance } from '@/lib/auth/finance-auth';
import { prisma } from '@/lib/db/prisma';
import { Prisma, LedgerEntryType, InvoiceStatus } from '@prisma/client';
import { SignOutButton } from '../SignOutButton';
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
  CreditCard,
  Receipt,
  FileText,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ArrowRight,
} from 'lucide-react';

interface FinanceDashboardProps {
  params: {
    orgSlug: string;
  };
}

export default async function FinanceDashboardPage({ params }: FinanceDashboardProps) {
  const { orgSlug } = params;
  const session = await auth();

  // Redirect to login if unauthenticated
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/finance`);
  }

  // Attempt to resolve tenant context securely server-side
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

  const { tenantId, tenantName, role, user } = tenantContext;

  // RBAC Permission Check
  if (!canViewFinance(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card p-6 shadow-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground">
            Your role (<span className="font-semibold text-foreground">{role}</span>) does not have permission to view the Financial Overview in this workspace.
          </p>
          <div className="pt-2">
            <Link
              href={`/${orgSlug}`}
              className="inline-flex items-center text-xs font-medium text-primary hover:underline"
            >
              ← Return to Main Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVER-SIDE TENANT-SCOPED FINANCIAL KPI CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Total Net Recognized Revenue (from REVENUE ledger entries, net of refunds)
  const revenueAgg = await prisma.ledgerEntry.aggregate({
    where: {
      tenantId,
      type: LedgerEntryType.REVENUE,
    },
    _sum: {
      amount: true,
    },
  });
  const totalRevenue = new Prisma.Decimal(revenueAgg._sum.amount?.toString() || '0.00');

  // 2. Total Recognized Expenses (from EXPENSE ledger entries)
  const expenseAgg = await prisma.ledgerEntry.aggregate({
    where: {
      tenantId,
      type: LedgerEntryType.EXPENSE,
    },
    _sum: {
      amount: true,
    },
  });
  const totalExpenses = new Prisma.Decimal(expenseAgg._sum.amount?.toString() || '0.00');

  // 3. Net Cash Flow / Profit = Revenue - Expenses
  const netProfit = totalRevenue.sub(totalExpenses);
  const isNetProfitPositive = netProfit.greaterThanOrEqualTo(0);

  // 4. Accounts Receivable & Outstanding Invoices (ISSUED, PARTIALLY_PAID, OVERDUE)
  const outstandingAgg = await prisma.invoice.aggregate({
    where: {
      tenantId,
      status: {
        in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
      },
    },
    _sum: {
      balance: true,
    },
    _count: {
      id: true,
    },
  });
  const accountsReceivable = new Prisma.Decimal(outstandingAgg._sum.balance?.toString() || '0.00');
  const outstandingInvoicesCount = outstandingAgg._count.id || 0;

  // 5. Paid Invoices
  const paidInvoicesAgg = await prisma.invoice.aggregate({
    where: {
      tenantId,
      status: InvoiceStatus.PAID,
    },
    _sum: {
      total: true,
    },
    _count: {
      id: true,
    },
  });
  const paidInvoicesCount = paidInvoicesAgg._count.id || 0;
  const paidInvoicesTotal = new Prisma.Decimal(paidInvoicesAgg._sum.total?.toString() || '0.00');

  // 6. Overdue Invoices
  const overdueAgg = await prisma.invoice.aggregate({
    where: {
      tenantId,
      status: InvoiceStatus.OVERDUE,
    },
    _sum: {
      balance: true,
    },
    _count: {
      id: true,
    },
  });
  const overdueInvoicesCount = overdueAgg._count.id || 0;
  const overdueBalance = new Prisma.Decimal(overdueAgg._sum.balance?.toString() || '0.00');

  // 7. Recent Financial Activity (Latest 8 Ledger Entries)
  const recentLedgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      tenantId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 8,
    include: {
      createdByUser: {
        select: { name: true, email: true },
      },
      invoice: {
        select: { invoiceNumber: true, status: true },
      },
      payment: {
        select: { paymentNumber: true, paymentMethod: true, status: true },
      },
      expense: {
        select: { expenseNumber: true, category: true, payee: true },
      },
    },
  });

  // Navigation module list
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

  const quickNavCards = [
    {
      title: 'Invoices',
      description: 'Manage drafts, issue invoices, and track payment statuses.',
      href: `/${orgSlug}/finance/invoices`,
      icon: FileText,
      badge: `${outstandingInvoicesCount} Outstanding`,
      color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-400',
    },
    {
      title: 'Payments',
      description: 'Record customer payments, reconcile transactions, and issue refunds.',
      href: `/${orgSlug}/finance/payments`,
      icon: CreditCard,
      badge: `$${totalRevenue.toFixed(2)} Collected`,
      color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400',
    },
    {
      title: 'Expenses',
      description: 'Log vendor expenses, track operating costs, and manage categories.',
      href: `/${orgSlug}/finance/expenses`,
      icon: Receipt,
      badge: `$${totalExpenses.toFixed(2)} Total`,
      color: 'from-rose-500/10 to-amber-500/10 border-rose-500/20 text-rose-400',
    },
    {
      title: 'General Ledger',
      description: 'Audit-ready, append-only double-entry financial ledger journal.',
      href: `/${orgSlug}/finance/ledger`,
      icon: BookOpen,
      badge: 'Immutable Log',
      color: 'from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-400',
    },
    {
      title: 'Accounts Receivable',
      description: 'Track overdue accounts, aging schedules, and pending collections.',
      href: `/${orgSlug}/finance/receivables`,
      icon: Wallet,
      badge: `$${accountsReceivable.toFixed(2)} Pending`,
      color: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-400',
    },
  ];

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
              <div className="text-xs text-muted-foreground">Financial Platform</div>
            </div>
          </Link>

          {/* Active Tenant Context */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Active Workspace
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

        {/* Footer User Profile & Role Info */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="text-xs font-semibold text-foreground truncate">{user.name || 'User'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono border shrink-0 ${
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
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Financial Overview</h1>
              <p className="text-xs text-muted-foreground">
                Workspace financial health, real-time KPI ledger metrics & cash flow
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Ledger Immutable
            </span>
            <Link
              href={`/${orgSlug}`}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Overview Dashboard
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Top Tenant Scoping Banner */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Financial Control Hub — {tenantName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  All metrics are calculated server-side with strict tenant isolation and Decimal-safe financial arithmetic.
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <span className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono text-muted-foreground">
                Tenant: {orgSlug}
              </span>
            </div>
          </div>

          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Total Revenue */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Revenue</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                ${totalRevenue.toFixed(2)}
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <ArrowUpRight className="h-3 w-3" /> Recognized cash inflow
              </p>
            </div>

            {/* Total Expenses */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Expenses</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                ${totalExpenses.toFixed(2)}
              </div>
              <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                <ArrowDownRight className="h-3 w-3" /> Operating outflows
              </p>
            </div>

            {/* Net Cash Flow / Profit */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Net Cash Flow</span>
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    isNetProfitPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div
                className={`text-2xl font-bold tracking-tight ${
                  isNetProfitPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ${netProfit.toFixed(2)}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                {isNetProfitPositive ? 'Net positive operating margin' : 'Net negative deficit'}
              </p>
            </div>

            {/* Accounts Receivable */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Accounts Receivable</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                ${accountsReceivable.toFixed(2)}
              </div>
              <p className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
                <Clock className="h-3 w-3" /> Uncollected customer balances
              </p>
            </div>

            {/* Outstanding Invoices */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Outstanding Invoices</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {outstandingInvoicesCount}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                {overdueInvoicesCount > 0 ? (
                  <span className="text-rose-400 font-medium">{overdueInvoicesCount} overdue</span>
                ) : (
                  <span>All in healthy cycle</span>
                )}
              </p>
            </div>

            {/* Paid Invoices */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Paid Invoices</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {paidInvoicesCount}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                ${paidInvoicesTotal.toFixed(2)} fully settled
              </p>
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Financial Management Modules
              </h2>
              <span className="text-xs text-muted-foreground">Quick access to accounting records</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {quickNavCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} border`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                          {card.badge}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          {card.title}
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {card.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-primary flex items-center gap-1 pt-1 border-t border-border/50">
                      Open {card.title} →
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Recent Ledger Transactions
                </h2>
              </div>
              <Link
                href={`/${orgSlug}/finance/ledger`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View General Ledger →
              </Link>
            </div>

            {recentLedgerEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Receipt className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-foreground">No financial activity recorded yet</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Issue invoices, record payments, or log operating expenses to generate immutable double-entry ledger records.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3 font-medium">Type</th>
                      <th className="py-2.5 px-3 font-medium">Reference</th>
                      <th className="py-2.5 px-3 font-medium">Description</th>
                      <th className="py-2.5 px-3 font-medium">Recorded By</th>
                      <th className="py-2.5 px-3 font-medium">Date</th>
                      <th className="py-2.5 px-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recentLedgerEntries.map((entry) => {
                      const isRevenue = entry.type === LedgerEntryType.REVENUE;
                      const decAmount = new Prisma.Decimal(entry.amount.toString());
                      const isNegative = decAmount.lessThan(0);

                      let refText = entry.referenceType;
                      if (entry.payment?.paymentNumber) {
                        refText = entry.payment.paymentNumber;
                      } else if (entry.expense?.expenseNumber) {
                        refText = entry.expense.expenseNumber;
                      } else if (entry.invoice?.invoiceNumber) {
                        refText = entry.invoice.invoiceNumber;
                      }

                      return (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                isRevenue
                                  ? isNegative
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {isRevenue ? (isNegative ? 'REFUND' : 'REVENUE') : 'EXPENSE'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground font-mono text-[11px]">
                            {refText}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground truncate max-w-xs">
                            {entry.description}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">
                            {entry.createdByUser?.name || entry.createdByUser?.email || 'System'}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {new Date(entry.entryDate).toLocaleDateString()}
                          </td>
                          <td
                            className={`py-2.5 px-3 font-semibold text-right font-mono ${
                              isRevenue
                                ? isNegative
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {isNegative ? '-' : '+'}${Math.abs(parseFloat(decAmount.toString())).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
