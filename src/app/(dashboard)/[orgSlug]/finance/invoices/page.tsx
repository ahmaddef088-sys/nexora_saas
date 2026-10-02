import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { canViewFinance } from '@/lib/auth/finance-auth';
import { prisma } from '@/lib/db/prisma';
import { OrderStatus } from '@prisma/client';
import { SignOutButton } from '../../SignOutButton';
import {
  InvoicesManagementClient,
  SerializedInvoice,
  SerializedInvoiceItem,
  CustomerOption,
  ProductOption,
  EligibleOrder,
} from './InvoicesManagementClient';
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
} from 'lucide-react';

interface InvoicesPageProps {
  params: {
    orgSlug: string;
  };
}

export default async function InvoicesPage({ params }: InvoicesPageProps) {
  const { orgSlug } = params;
  const session = await auth();

  // Redirect to login if unauthenticated
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/finance/invoices`);
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

  // RBAC: All verified workspace roles can view finance
  if (!canViewFinance(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card p-6 shadow-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground">
            Your role (<span className="font-semibold text-foreground">{role}</span>) does not have permission to view Invoices in this workspace.
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

  // ─── Server-side tenant-scoped data fetching ───────────────────────────────

  // 1. All tenant invoices with full relations
  const rawInvoices = await prisma.invoice.findMany({
    where: { tenantId },
    include: {
      customer: {
        select: { id: true, name: true, companyName: true, email: true },
      },
      order: {
        select: { id: true },
      },
      items: {
        include: {
          product: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      createdByUser: {
        select: { name: true, email: true },
      },
      payments: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Active customers for create dropdown
  const rawCustomers = await prisma.customer.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, companyName: true, email: true },
    orderBy: { name: 'asc' },
  });

  // 3. Active products for line items
  const rawProducts = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, sku: true, price: true },
    orderBy: { name: 'asc' },
  });

  // 4. Eligible orders (CONFIRMED or COMPLETED) — for "Generate from Order" flow
  const rawEligibleOrders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] },
    },
    select: {
      id: true,
      status: true,
      total: true,
      customer: { select: { name: true } },
      invoice: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ─── Serialize data (Decimal → string, Date → ISO string) ─────────────────

  const serializedInvoices: SerializedInvoice[] = rawInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    customerId: inv.customerId,
    customerName: inv.customer.name,
    customerEmail: inv.customer.email,
    customerCompany: inv.customer.companyName,
    orderId: inv.orderId ?? null,
    orderRef: inv.orderId ? `ORD-${inv.orderId.slice(-6).toUpperCase()}` : null,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    subtotal: inv.subtotal.toString(),
    taxRate: inv.taxRate.toString(),
    taxAmount: inv.taxAmount.toString(),
    discount: inv.discount.toString(),
    total: inv.total.toString(),
    paidAmount: inv.paidAmount.toString(),
    balance: inv.balance.toString(),
    notes: inv.notes,
    terms: inv.terms,
    createdByName: inv.createdByUser?.name ?? null,
    createdByEmail: inv.createdByUser?.email ?? null,
    createdAt: inv.createdAt.toISOString(),
    paymentsCount: inv.payments.length,
    items: inv.items.map((item): SerializedInvoiceItem => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  }));

  const customerOptions: CustomerOption[] = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    companyName: c.companyName,
    email: c.email,
  }));

  const productOptions: ProductOption[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price.toString(),
  }));

  const eligibleOrders: EligibleOrder[] = rawEligibleOrders.map((o) => ({
    id: o.id,
    orderRef: `ORD-${o.id.slice(-6).toUpperCase()}`,
    customerName: o.customer.name,
    total: o.total.toString(),
    status: o.status,
    hasInvoice: o.invoice !== null,
  }));

  // ─── Sidebar navigation ────────────────────────────────────────────────────

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
              { name: 'Invoices', path: `/${orgSlug}/finance/invoices`, current: true },
              { name: 'Payments', path: `/${orgSlug}/finance/payments`, current: false },
              { name: 'Expenses', path: `/${orgSlug}/finance/expenses`, current: false },
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
                <FileText className="h-3.5 w-3.5" />
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Invoices</h1>
              <p className="text-xs text-muted-foreground">
                Create, manage, issue, and track invoices for {tenantName}
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
          <InvoicesManagementClient
            orgSlug={orgSlug}
            tenantName={tenantName}
            currentUserRole={role}
            invoices={serializedInvoices}
            customers={customerOptions}
            products={productOptions}
            eligibleOrders={eligibleOrders}
          />
        </main>
      </div>
    </div>
  );
}
