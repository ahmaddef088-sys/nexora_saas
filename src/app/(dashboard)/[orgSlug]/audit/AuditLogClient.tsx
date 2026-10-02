'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Role } from '@prisma/client';
import {
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileJson,
  Copy,
  Check,
  Activity,
  Layers,
  Terminal,
  ArrowRight,
  Globe,
  Info,
} from 'lucide-react';
import {
  AuditEntity,
  auditEntityLabels,
  auditActionLabels,
  getAuditActionBadge,
  getAuditEntityBadge,
} from '@/lib/utils/audit-constants';

export interface SerializedAuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  logs: SerializedAuditLog[];
}

const PAGE_SIZE = 20;

export function AuditLogClient({
  orgSlug,
  tenantName,
  currentUserRole,
  logs,
}: AuditLogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<SerializedAuditLog | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter logs based on search and selected entity / date
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date().getTime();

    return logs.filter((log) => {
      // 1. Search matching
      const actorMatch =
        (log.userName?.toLowerCase().includes(q) ?? false) ||
        (log.userEmail?.toLowerCase().includes(q) ?? false) ||
        (!log.userName && !log.userEmail && 'system'.includes(q));

      const actionMatch =
        log.action.toLowerCase().includes(q) ||
        (auditActionLabels[log.action]?.toLowerCase().includes(q) ?? false);

      const entityMatch =
        log.entity.toLowerCase().includes(q) ||
        (auditEntityLabels[log.entity]?.toLowerCase().includes(q) ?? false) ||
        (log.entityId?.toLowerCase().includes(q) ?? false);

      const metadataMatch = log.metadata
        ? JSON.stringify(log.metadata).toLowerCase().includes(q)
        : false;

      const matchesSearch =
        q === '' || actorMatch || actionMatch || entityMatch || metadataMatch;

      // 2. Entity filter matching
      const matchesEntity = entityFilter === 'ALL' || log.entity === entityFilter;

      // 3. Date filter matching
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const logTime = new Date(log.createdAt).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);

        if (dateFilter === 'TODAY') {
          matchesDate = diffHours <= 24;
        } else if (dateFilter === '7DAYS') {
          matchesDate = diffHours <= 24 * 7;
        } else if (dateFilter === '30DAYS') {
          matchesDate = diffHours <= 24 * 30;
        }
      }

      return matchesSearch && matchesEntity && matchesDate;
    });
  }, [logs, searchQuery, entityFilter, dateFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = filteredLogs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // KPI Calculations
  const totalEvents = logs.length;
  const uniqueActors = new Set(
    logs.map((l) => l.userEmail || l.userId || 'SYSTEM')
  ).size;
  const todayEvents = logs.filter((l) => {
    const diff = (Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60);
    return diff <= 24;
  }).length;

  const handleCopyJson = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Logs</h1>
            <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-400 font-mono">
              {totalEvents} Recorded Events
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable activity stream and compliance trail for workspace <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-md">
            <ShieldCheck className="h-4 w-4 mr-1.5 text-emerald-400" />
            Append-Only Trail
          </span>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Audit Events
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{totalEvents}</div>
          <div className="text-[10px] text-muted-foreground">Historical records retained</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Actors
          </div>
          <div className="text-2xl font-bold font-mono text-primary">{uniqueActors}</div>
          <div className="text-[10px] text-muted-foreground">Unique users logged</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Activity (Last 24h)
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{todayEvents}</div>
          <div className="text-[10px] text-muted-foreground">Recent system operations</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Access Policy
          </div>
          <div className="text-sm font-bold font-mono text-purple-400 mt-1">Admin / Owner Only</div>
          <div className="text-[10px] text-muted-foreground">RBAC strict role gating</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="audit-search"
            type="text"
            placeholder="Search by action, user, entity ID, metadata..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Entity Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Entities</option>
              <option value="INVOICE">Invoices</option>
              <option value="PAYMENT">Payments</option>
              <option value="EXPENSE">Expenses</option>
              <option value="ORDER">Orders</option>
              <option value="PRODUCT">Products</option>
              <option value="CATEGORY">Categories</option>
              <option value="INVENTORY">Inventory</option>
              <option value="CUSTOMER">Customers</option>
              <option value="MEMBER">Team Members</option>
            </select>
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Last 24 Hours</option>
            <option value="7DAYS">Last 7 Days</option>
            <option value="30DAYS">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity Reference</th>
                <th className="px-4 py-3">Metadata Summary</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Activity className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-foreground text-sm">
                        {searchQuery || entityFilter !== 'ALL' || dateFilter !== 'ALL'
                          ? 'No audit records match your search criteria.'
                          : 'No audit records available in this workspace.'}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {searchQuery || entityFilter !== 'ALL' || dateFilter !== 'ALL'
                          ? 'Try clearing the search query or adjusting the filters.'
                          : 'Audit logs will automatically be recorded as workspace operations are performed.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => {
                  const actionBadge = getAuditActionBadge(log.action);
                  const entityBadge = getAuditEntityBadge(log.entity);
                  const parsedDate = new Date(log.createdAt);

                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        <div>{parsedDate.toISOString().split('T')[0]}</div>
                        <div className="text-[10px] text-muted-foreground/70">
                          {parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">
                          {log.userName || (log.userEmail ? log.userEmail.split('@')[0] : 'System')}
                        </div>
                        {log.userEmail && (
                          <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px]">
                            {log.userEmail}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${actionBadge.cls}`}
                        >
                          {actionBadge.label}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${entityBadge.cls}`}
                        >
                          {entityBadge.label}
                        </span>
                      </td>

                      {/* Entity Reference / ID */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-foreground">
                        {log.entityId ? (
                          <span className="bg-muted px-1.5 py-0.5 rounded border border-border">
                            {log.entityId.length > 18 ? `${log.entityId.slice(0, 10)}...${log.entityId.slice(-4)}` : log.entityId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Metadata Summary */}
                      <td className="px-4 py-3.5 max-w-[280px]">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {Object.entries(log.metadata)
                              .slice(0, 3)
                              .map(([key, val]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border"
                                >
                                  <strong className="text-foreground mr-1">{key}:</strong>
                                  {typeof val === 'object' ? '...' : String(val)}
                                </span>
                              ))}
                            {Object.keys(log.metadata).length > 3 && (
                              <span className="text-muted-foreground font-mono text-[10px]">
                                +{Object.keys(log.metadata).length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action: Inspector */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center space-x-1 p-1.5 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                          title="Inspect Audit Event"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} events
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-medium text-foreground">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DETAIL INSPECTOR MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Terminal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Audit Event Inspector</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Event Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Action</div>
                  <div className="font-semibold text-foreground">{selectedLog.action}</div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Entity</div>
                  <div className="font-semibold text-foreground">{selectedLog.entity}</div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Entity ID</div>
                  <div className="font-mono text-foreground truncate">{selectedLog.entityId || '—'}</div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Actor</div>
                  <div className="font-semibold text-foreground truncate">
                    {selectedLog.userName || 'System'}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{selectedLog.userEmail || '—'}</div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Timestamp</div>
                  <div className="font-mono text-foreground text-[11px]">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">IP / Client</div>
                  <div className="font-mono text-muted-foreground text-[11px]">
                    {selectedLog.ipAddress || 'Internal server'}
                  </div>
                </div>
              </div>

              {/* JSON Metadata Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileJson className="h-3.5 w-3.5 text-primary" />
                    Structured Payload (Metadata)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(selectedLog.metadata || {})}
                    className="inline-flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-muted border border-border"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>

                <pre className="rounded-lg border border-border bg-muted/50 p-4 font-mono text-[11px] text-foreground overflow-x-auto max-h-60 leading-relaxed">
                  {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0
                    ? JSON.stringify(selectedLog.metadata, null, 2)
                    : '// No metadata attached to this event'}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-border px-6 py-3 bg-muted/20">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-md border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
