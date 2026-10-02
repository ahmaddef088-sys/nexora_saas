import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { canViewFinance } from '@/lib/auth/finance-auth';
import { prisma } from '@/lib/db/prisma';
import { SignOutButton } from '../../SignOutButton';
import {
  ExpensesManagementClient,
  SerializedExpense,
} from './ExpensesManagementClient';
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
  Receipt,
} from 'lucide-react';

interface ExpensesPageProps {
  params: {
    orgSlug: string;
  };
}

export default async function ExpensesPage({ params }: ExpensesPageProps) {
  const { orgSlug } = params;
  const session = await auth();

  // Redirect to login if unauthenticated
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/finance/expenses`);
  }

  // Resolve tenant context server-side
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
            Your role (<span className="font-semibold text-foreground">{role}</span>) does not have permission to view Expenses in this workspace.
          </p>
          <div className="pt-2">
            <Link
              href={`/${orgSlug}/finance`}
              className="inline-flex items-center text-xs font-medium text-primary hover:underline"
            >
              ← Return to Financial Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Server-side tenant-scoped queries ─────────────────────────────────────

  const rawExpenses = await prisma.expense.findMany({
    where: { tenantId },
    include: {
      createdByUser: {
        select: { name: true, email: true },
      },
    },
    orderBy: { expenseDate: 'desc' },
  });

  // ─── Serialize Data ────────────────────────────────────────────────────────

  const serializedExpenses: SerializedExpense[] = rawExpenses.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    category: e.category,
    payee: e.payee,
    amount: e.amount.toString(),
    taxAmount: e.taxAmount.toString(),
    total: e.total.toString(),
    expenseDate: e.expenseDate.toISOString(),
    paymentMethod: e.paymentMethod,
    reference: e.reference,
    notes: e.notes,
    receiptUrl: e.receiptUrl,
    createdByName: e.createdByUser?.name ?? null,
    createdByEmail: e.createdByUser?.email ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

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

          {/* Finance Sub-Navigation */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              Finance
            </div>
            {[
              { name: 'Overview', path: `/${orgSlug}/finance`, current: false },
              { name: 'Invoices', path: `/${orgSlug}/finance/invoices`, current: false },
              { name: 'Payments', path: `/${orgSlug}/finance/payments`, current: false },
              { name: 'Expenses', path: `/${orgSlug}/finance/expenses`, current: true },
              { name: 'General Ledger', path: `/${orgSlug}/finance/ledger`, current: false },
              { name: 'Receivables', path: `/${orgSlug}/finance/receivables`, current: false },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center space-x-2.5 px-3 py-2 text-xs rounded-md transition-colors ${
                  item.current
                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Module Navigation List */}
          <nav className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              All Modules
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
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Expenses</h1>
              <p className="text-xs text-muted-foreground">
                Operational costs, vendor vouchers & expense audit ledger for {tenantName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Tenant Isolated
            </span>
            <Link
              href={`/${orgSlug}/finance`}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              ← Financial Overview
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 flex-1 overflow-y-auto">
          <ExpensesManagementClient
            orgSlug={orgSlug}
            tenantName={tenantName}
            currentUserRole={role}
            expenses={serializedExpenses}
          />
        </main>
      </div>
    </div>
  );
}
