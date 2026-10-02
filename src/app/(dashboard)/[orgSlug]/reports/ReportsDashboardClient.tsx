'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Role } from '@prisma/client';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  CreditCard,
  Receipt,
  FileText,
  Calendar,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle,
  Filter,
} from 'lucide-react';
import {
  DateRangePreset,
  dateRangeLabels,
} from '@/lib/utils/reports-constants';
import { ReportsData } from '@/lib/services/reports-service';

interface ReportsDashboardClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  data: ReportsData;
}

export function ReportsDashboardClient({
  orgSlug,
  tenantName,
  currentUserRole,
  data,
}: ReportsDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'sales' | 'products' | 'customers' | 'expenses'
  >('overview');

  const currentPreset = (searchParams.get('preset') as DateRangePreset) || data.preset || 'ALL';

  const handlePresetChange = (preset: DateRangePreset) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', preset);
    router.push(`${pathname}?${params.toString()}`);
  };

  const numRevenue = parseFloat(data.financials.collectedRevenue);
  const numInvoiced = parseFloat(data.financials.invoicedRevenue);
  const numExpenses = parseFloat(data.financials.totalExpenses);
  const numNet = parseFloat(data.financials.netProfit);
  const numAR = parseFloat(data.financials.accountsReceivable);
  const numRefunds = parseFloat(data.financials.refundedAmount);
  const numOrderValue = parseFloat(data.orders.totalValue);

  // Profit Margin calculation
  const profitMargin = numRevenue > 0 ? (numNet / numRevenue) * 100 : 0;

  // Max value for trend chart scaling
  const maxTrendVal = Math.max(
    ...data.monthlyTrends.map((t) => Math.max(t.revenue, t.expenses)),
    100
  );

  return (
    <div className="space-y-6">
      {/* Header & Date Range Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary font-mono">
              {dateRangeLabels[currentPreset]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enterprise analytics, sales intelligence, and financial health for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-1 rounded-lg border border-border bg-card p-1 text-xs">
            {(['ALL', 'TODAY', '7DAYS', '30DAYS', 'THIS_MONTH', 'THIS_YEAR'] as DateRangePreset[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    currentPreset === p
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {dateRangeLabels[p]}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Net Profit / Cash Flow */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Net Balance</span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              numNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${numNet.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {numRevenue > 0 ? `${profitMargin.toFixed(1)}% margin` : 'Revenue − Expenses'}
          </div>
        </div>

        {/* Collected Revenue */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Collected Cash</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">${numRevenue.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">${numInvoiced.toFixed(2)} invoiced</div>
        </div>

        {/* Total Expenses */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Total Expenses</span>
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">${numExpenses.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{data.financials.expenseCount} logged expenses</div>
        </div>

        {/* Accounts Receivable */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Outstanding AR</span>
            <CreditCard className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">${numAR.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{data.invoices.issuedCount + data.invoices.partiallyPaidCount + data.invoices.overdueCount} unpaid invoices</div>
        </div>

        {/* Orders Placed */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Orders Value</span>
            <ShoppingCart className="h-3.5 w-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold font-mono text-teal-400">${numOrderValue.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">{data.orders.confirmedCount + data.orders.completedCount} fulfilled orders</div>
        </div>

        {/* Active Customers */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Customers</span>
            <Users className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{data.customers.totalCount}</div>
          <div className="text-[10px] text-muted-foreground">{data.customers.activeCount} active in system</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-1 border-b border-border text-xs overflow-x-auto">
        {[
          { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
          { id: 'sales', label: 'Sales & Orders', icon: ShoppingCart },
          { id: 'products', label: 'Products & Inventory', icon: Package },
          { id: 'customers', label: 'Customer Insights', icon: Users },
          { id: 'expenses', label: 'Expenses & Cash Flow', icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: EXECUTIVE OVERVIEW & TRENDS
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Revenue vs Expenses Trend Visual Chart */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Monthly Financial Performance Trend</h3>
                <p className="text-xs text-muted-foreground">Collected revenue vs recorded expenses over time</p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
                  <span className="text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-rose-500" />
                  <span className="text-muted-foreground">Expenses</span>
                </div>
              </div>
            </div>

            {/* Custom SVG / Bar Visual */}
            <div className="h-56 w-full pt-4 flex items-end justify-between gap-2 border-b border-border">
              {data.monthlyTrends.map((t) => {
                const revHeight = maxTrendVal > 0 ? (t.revenue / maxTrendVal) * 100 : 0;
                const expHeight = maxTrendVal > 0 ? (t.expenses / maxTrendVal) * 100 : 0;

                return (
                  <div key={t.period} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="flex items-end gap-1 w-full max-w-[48px] h-40">
                      <div
                        style={{ height: `${Math.max(revHeight, 4)}%` }}
                        className="flex-1 bg-emerald-500/80 group-hover:bg-emerald-500 rounded-t transition-all relative"
                        title={`Revenue: $${t.revenue.toFixed(2)}`}
                      />
                      <div
                        style={{ height: `${Math.max(expHeight, 4)}%` }}
                        className="flex-1 bg-rose-500/80 group-hover:bg-rose-500 rounded-t transition-all relative"
                        title={`Expenses: $${t.expenses.toFixed(2)}`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[54px]">
                      {t.period}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Settlement Performance */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">Invoice & Receivables Breakdown</h3>
                <Link
                  href={`/${orgSlug}/finance/receivables`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <span>Receivables Aging</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Total Invoiced</div>
                  <div className="text-lg font-bold font-mono text-foreground">${numInvoiced.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{data.invoices.totalCount} total invoices</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Settled Cash</div>
                  <div className="text-lg font-bold font-mono text-emerald-400">${parseFloat(data.financials.paidInvoicesAmount).toFixed(2)}</div>
                  <div className="text-[10px] text-emerald-400">{data.invoices.paidCount} fully paid</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Outstanding AR</div>
                  <div className="text-lg font-bold font-mono text-amber-400">${numAR.toFixed(2)}</div>
                  <div className="text-[10px] text-amber-400">{data.invoices.overdueCount} overdue invoices</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Refund Volume</div>
                  <div className="text-lg font-bold font-mono text-rose-400">${numRefunds.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{data.financials.refundCount} refunded payments</div>
                </div>
              </div>
            </div>

            {/* Inventory Valuation & Alerts */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">Inventory Valuation & Alerts</h3>
                <Link
                  href={`/${orgSlug}/products/inventory`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <span>Inventory History</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Cost Valuation</div>
                  <div className="text-lg font-bold font-mono text-foreground">${parseFloat(data.products.totalCostValuation).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Based on product cost</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Retail Valuation</div>
                  <div className="text-lg font-bold font-mono text-primary">${parseFloat(data.products.totalRetailValuation).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Potential retail value</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Total Stock Units</div>
                  <div className="text-lg font-bold font-mono text-foreground">{data.products.totalInventoryUnits} units</div>
                  <div className="text-[10px] text-muted-foreground">{data.products.activeProducts} active products</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Stock Alerts</div>
                  <div className="text-lg font-bold font-mono text-amber-400">{data.products.lowStockCount + data.products.outOfStockCount} items</div>
                  <div className="text-[10px] text-rose-400">{data.products.outOfStockCount} out of stock</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: SALES & ORDERS ANALYTICS
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Order Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Total Orders</div>
              <div className="text-2xl font-bold font-mono text-foreground">{data.orders.totalCount}</div>
              <div className="text-[10px] text-muted-foreground">In selected time range</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Fulfilled Orders</div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {data.orders.confirmedCount + data.orders.completedCount}
              </div>
              <div className="text-[10px] text-emerald-400">Confirmed / Completed</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Fulfilled Value</div>
              <div className="text-2xl font-bold font-mono text-teal-400">${numOrderValue.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">Revenue generated</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Avg. Order Value</div>
              <div className="text-2xl font-bold font-mono text-primary">${parseFloat(data.orders.averageOrderValue).toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">Per fulfilled order</div>
            </div>
          </div>

          {/* Status Breakdown Bar & Table */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground">Order Status Distribution</h3>

            {/* Visual Distribution Segmented Bar */}
            <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden flex">
              {data.orders.statusDistribution.map((st) => {
                let colorClass = 'bg-slate-500';
                if (st.status === 'COMPLETED') colorClass = 'bg-emerald-500';
                if (st.status === 'CONFIRMED') colorClass = 'bg-teal-500';
                if (st.status === 'DRAFT') colorClass = 'bg-blue-500';
                if (st.status === 'CANCELLED') colorClass = 'bg-rose-500';

                return st.percentage > 0 ? (
                  <div
                    key={st.status}
                    style={{ width: `${st.percentage}%` }}
                    className={`${colorClass} transition-all`}
                    title={`${st.label}: ${st.count} orders (${st.percentage}%)`}
                  />
                ) : null;
              })}
            </div>

            {/* Status Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-center">Orders</th>
                    <th className="px-4 py-2.5 text-center">Percentage</th>
                    <th className="px-4 py-2.5 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.orders.statusDistribution.map((st) => (
                    <tr key={st.status} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-semibold text-foreground">{st.label}</td>
                      <td className="px-4 py-3 text-center font-mono">{st.count}</td>
                      <td className="px-4 py-3 text-center font-mono">{st.percentage}%</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        ${parseFloat(st.value).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: PRODUCTS & INVENTORY
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Products by Revenue */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground">Top Products by Revenue</h3>
              {data.products.topProductsByRevenue.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No product sales recorded in this time range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-[11px] font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2">Product</th>
                        <th className="py-2 text-center">Qty Sold</th>
                        <th className="py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.products.topProductsByRevenue.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="py-2.5">
                            <div className="font-semibold text-foreground">{p.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                          </td>
                          <td className="py-2.5 text-center font-mono">{p.quantitySold}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                            ${parseFloat(p.revenue).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Products by Volume */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground">Top Products by Volume Sold</h3>
              {data.products.topProductsByVolume.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No product sales recorded in this time range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-[11px] font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2">Product</th>
                        <th className="py-2 text-center">Units Sold</th>
                        <th className="py-2 text-right">Sales Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.products.topProductsByVolume.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="py-2.5">
                            <div className="font-semibold text-foreground">{p.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                          </td>
                          <td className="py-2.5 text-center font-mono font-bold text-primary">
                            {p.quantitySold} units
                          </td>
                          <td className="py-2.5 text-right font-mono text-muted-foreground">
                            ${parseFloat(p.revenue).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Watchlist */}
          {data.products.lowStockItems.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="font-semibold text-sm text-foreground">Low Stock & Out-of-Stock Watchlist</h3>
                </div>
                <Link
                  href={`/${orgSlug}/products`}
                  className="text-xs text-primary hover:underline"
                >
                  Manage Products
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {data.products.lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">SKU: {item.sku}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div
                        className={`font-bold ${
                          item.quantity === 0 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        {item.quantity === 0 ? 'OUT OF STOCK' : `${item.quantity} units`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Reorder at {item.reorderLevel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: CUSTOMERS ANALYTICS
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Top Customers by Revenue</h3>
                <p className="text-xs text-muted-foreground">Customer order spend and outstanding credit balances</p>
              </div>
              <Link
                href={`/${orgSlug}/customers`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <span>All Customers</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {data.customers.topCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No customer spend records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Customer</th>
                      <th className="px-4 py-2.5">Company</th>
                      <th className="px-4 py-2.5 text-center">Orders</th>
                      <th className="px-4 py-2.5 text-right">Total Spend</th>
                      <th className="px-4 py-2.5 text-right">Unpaid Debt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.customers.topCustomers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{cust.name}</div>
                          {cust.email && (
                            <div className="font-mono text-[10px] text-muted-foreground">{cust.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{cust.companyName || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono">{cust.orderCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          ${parseFloat(cust.totalSpend).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                          ${parseFloat(cust.outstandingBalance).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 5: EXPENSES & CASH FLOW
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Expense Categories Breakdown */}
            <div className="md:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">Expense Category Breakdown</h3>
                <Link
                  href={`/${orgSlug}/finance/expenses`}
                  className="text-xs text-primary hover:underline"
                >
                  Manage Expenses
                </Link>
              </div>

              {data.expenseCategories.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No expenses logged for the selected date range.
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {data.expenseCategories.map((cat) => (
                    <div key={cat.category} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{cat.label}</span>
                        <div className="flex items-center space-x-2 font-mono">
                          <span className="text-muted-foreground">{cat.percentage}%</span>
                          <span className="font-bold text-foreground">
                            ${parseFloat(cat.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          style={{ width: `${cat.percentage}%` }}
                          className="h-full bg-rose-500 rounded-full transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expense KPI summary */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground">Expense Metrics</h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Expenses</div>
                  <div className="text-xl font-bold font-mono text-rose-400">${numExpenses.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{data.financials.expenseCount} operations</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Average Expense</div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    ${parseFloat(data.financials.averageExpense).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Per logged expense</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Top Expense Category</div>
                  <div className="text-sm font-bold text-foreground truncate">
                    {data.expenseCategories[0]?.label || 'None'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {data.expenseCategories[0] ? `$${parseFloat(data.expenseCategories[0].amount).toFixed(2)}` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
