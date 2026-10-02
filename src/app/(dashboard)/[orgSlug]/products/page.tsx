import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRequiredTenantContext, getUserTenants } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  ProductsManagementClient,
  SerializedProduct,
  SerializedCategory,
} from './ProductsManagementClient';
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
} from 'lucide-react';

interface ProductsPageProps {
  params: {
    orgSlug: string;
  };
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { orgSlug } = params;
  const session = await auth();

  // Redirect to login if unauthenticated
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${orgSlug}/products`);
  }

  // Resolve tenant context securely server-side
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
              Your account (<strong className="text-foreground">{session.user.email}</strong>) is authenticated, but you are not an authorized member of the tenant workspace <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary font-bold">{orgSlug}</code>.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Nexora Business Suite strictly verifies tenant membership on every server request to prevent unauthorized multi-tenant data access.
            </p>
          </div>

          {userTenants.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Your Authorized Workspaces:
              </div>
              <div className="space-y-2">
                {userTenants.map((t) => (
                  <Link
                    key={t.tenantId}
                    href={`/${t.tenantSlug}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{t.tenantName}</span>
                    </div>
                    <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase">
                      {t.role}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              You are not assigned to any active workspaces yet.
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

  // Query only products belonging to this verified tenant
  const rawProducts = await prisma.product.findMany({
    where: {
      tenantId,
    },
    include: {
      category: {
        select: { id: true, name: true },
      },
      inventory: {
        select: { quantity: true, reorderLevel: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  // Query only categories belonging to this verified tenant
  const rawCategories = await prisma.category.findMany({
    where: {
      tenantId,
    },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const serializedProducts: SerializedProduct[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    price: p.price.toString(),
    cost: p.cost.toString(),
    isActive: p.isActive,
    categoryId: p.categoryId,
    category: p.category,
    inventory: p.inventory,
    createdAt: p.createdAt.toISOString(),
  }));

  const serializedCategories: SerializedCategory[] = rawCategories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    productCount: c._count.products,
  }));

  const modules = [
    { name: 'Dashboard', icon: LayoutDashboard, path: `/${orgSlug}`, active: false },
    { name: 'Users & Roles', icon: Users, path: `/${orgSlug}/users`, active: false },
    { name: 'Products & Inventory', icon: Package, path: `/${orgSlug}/products`, active: true },
    { name: 'Inventory History', icon: Boxes, path: `/${orgSlug}/products/inventory`, active: false },
    { name: 'Customers', icon: UserCheck, path: `/${orgSlug}/customers`, active: false },
    { name: 'Orders', icon: ShoppingCart, path: `/${orgSlug}/orders`, active: false },
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
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold text-foreground">Products Catalog</h1>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Tenant Isolated
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Switch Workspace
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 flex-1 overflow-y-auto">
          <ProductsManagementClient
            orgSlug={orgSlug}
            tenantName={tenantName}
            currentUserRole={role}
            products={serializedProducts}
            categories={serializedCategories}
          />
        </main>
      </div>
    </div>
  );
}
