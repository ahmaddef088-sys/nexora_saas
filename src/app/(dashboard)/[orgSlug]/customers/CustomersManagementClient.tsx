'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role } from '@prisma/client';
import {
  UserCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Edit2,
  Archive,
  Mail,
  Phone,
  Building,
  MapPin,
  FileText,
  Lock,
  ShoppingCart,
} from 'lucide-react';
import {
  createCustomerAction,
  updateCustomerAction,
  archiveCustomerAction,
} from '@/lib/actions/customers';
import {
  canCreateCustomer,
  canEditCustomer,
  canArchiveCustomer,
} from '@/lib/auth/order-auth';

export interface SerializedCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  isActive: boolean;
  orderCount: number;
  createdAt: string;
}

interface CustomersManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  customers: SerializedCustomer[];
}

export function CustomersManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  customers,
}: CustomersManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Feedback Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<SerializedCustomer | null>(null);
  const [archivingCustomer, setArchivingCustomer] = useState<SerializedCustomer | null>(null);

  // Add Form State
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addCompanyName, setAddCompanyName] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addNotes, setAddNotes] = useState('');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Permissions
  const canCreate = canCreateCustomer(currentUserRole).allowed;
  const canEdit = canEditCustomer(currentUserRole).allowed;
  const canArchive = canArchiveCustomer(currentUserRole).allowed;

  // Filtered List
  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      c.name.toLowerCase().includes(query) ||
      (c.email?.toLowerCase().includes(query) ?? false) ||
      (c.companyName?.toLowerCase().includes(query) ?? false) ||
      (c.city?.toLowerCase().includes(query) ?? false);

    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? c.isActive : !c.isActive);

    return matchesSearch && matchesStatus;
  });

  const metrics = {
    total: customers.length,
    active: customers.filter((c) => c.isActive).length,
    archived: customers.filter((c) => !c.isActive).length,
    totalOrders: customers.reduce((acc, c) => acc + c.orderCount, 0),
  };

  // Handlers
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createCustomerAction(orgSlug, {
        name: addName.trim(),
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        companyName: addCompanyName.trim() || undefined,
        address: addAddress.trim() || undefined,
        city: addCity.trim() || undefined,
        notes: addNotes.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Customer created successfully.' });
        setIsAddModalOpen(false);
        setAddName('');
        setAddEmail('');
        setAddPhone('');
        setAddCompanyName('');
        setAddAddress('');
        setAddCity('');
        setAddNotes('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create customer.' });
      }
    });
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await updateCustomerAction(orgSlug, {
        customerId: editingCustomer.id,
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        companyName: editCompanyName.trim() || undefined,
        address: editAddress.trim() || undefined,
        city: editCity.trim() || undefined,
        notes: editNotes.trim() || undefined,
        isActive: editIsActive,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Customer updated successfully.' });
        setEditingCustomer(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update customer.' });
      }
    });
  };

  const handleArchiveCustomer = async () => {
    if (!archivingCustomer) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await archiveCustomerAction(orgSlug, {
        customerId: archivingCustomer.id,
        isActive: !archivingCustomer.isActive,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Customer status updated.' });
        setArchivingCustomer(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to change customer status.' });
      }
    });
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers Directory</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {metrics.total} {metrics.total === 1 ? 'Customer' : 'Customers'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Maintain client relationships and track account orders for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate ? (
            <button
              id="add-customer-btn"
              onClick={() => {
                setFeedback(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Customer</span>
            </button>
          ) : (
            <div
              title="Only Owners and Administrators can add customers"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Add Customer (Admin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Customers
          </div>
          <div className="text-xl font-bold text-foreground">{metrics.total}</div>
          <div className="text-[10px] text-muted-foreground">{metrics.active} active accounts</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Accounts
          </div>
          <div className="text-xl font-bold text-emerald-400">{metrics.active}</div>
          <div className="text-[10px] text-muted-foreground">Eligible for order drafting</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Archived Accounts
          </div>
          <div className="text-xl font-bold text-muted-foreground">{metrics.archived}</div>
          <div className="text-[10px] text-muted-foreground">Historical records preserved</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Orders Placed
          </div>
          <div className="text-xl font-bold text-primary">{metrics.totalOrders}</div>
          <div className="text-[10px] text-muted-foreground">Across all client accounts</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, company, email, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ACTIVE">Active Only</option>
            <option value="ARCHIVED">Archived Only</option>
            <option value="ALL">All Accounts</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Customer / Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <UserCheck className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-xs">No customers found.</p>
                      <p className="text-[11px] text-muted-foreground/75">
                        Try adjusting your search query or add a new customer.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/20 transition-colors">
                    {/* Name & Company */}
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="font-medium text-foreground">{customer.name}</div>
                        {customer.companyName ? (
                          <div className="text-[11px] text-muted-foreground flex items-center space-x-1 mt-0.5">
                            <Building className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                            <span>{customer.companyName}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/60 italic">Individual</div>
                        )}
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        {customer.email ? (
                          <div className="flex items-center space-x-1.5 text-foreground">
                            <Mail className="h-3 w-3 text-primary shrink-0" />
                            <span>{customer.email}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/60 italic">No email</div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px]">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {customer.city || customer.address ? (
                        <div className="flex items-center space-x-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                          <span>{[customer.city, customer.address].filter(Boolean).join(', ')}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-[11px]">Unspecified</span>
                      )}
                    </td>

                    {/* Orders */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <ShoppingCart className="h-3 w-3" />
                        <span>{customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {customer.isActive ? (
                        <span className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                          Archived
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Edit Customer Button */}
                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setEditName(customer.name);
                            setEditEmail(customer.email || '');
                            setEditPhone(customer.phone || '');
                            setEditCompanyName(customer.companyName || '');
                            setEditAddress(customer.address || '');
                            setEditCity(customer.city || '');
                            setEditNotes(customer.notes || '');
                            setEditIsActive(customer.isActive);
                            setFeedback(null);
                          }}
                          disabled={!canEdit || isPending}
                          title={!canEdit ? 'Admin or Owner only' : 'Edit Customer'}
                          className={`p-1.5 rounded-md transition-colors ${
                            canEdit
                              ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              : 'text-muted-foreground/30 cursor-not-allowed'
                          }`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Archive / Reactivate Button */}
                        <button
                          onClick={() => {
                            setArchivingCustomer(customer);
                            setFeedback(null);
                          }}
                          disabled={!canArchive || isPending}
                          title={!canArchive ? 'Admin or Owner only' : customer.isActive ? 'Archive Customer' : 'Reactivate Customer'}
                          className={`p-1.5 rounded-md transition-colors ${
                            canArchive
                              ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                              : 'text-muted-foreground/30 cursor-not-allowed'
                          }`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD CUSTOMER */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Add New Customer</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Customer / Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Smith"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Global Tech Solutions"
                    value={addCompanyName}
                    onChange={(e) => setAddCompanyName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-1234"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    City / State
                  </label>
                  <input
                    type="text"
                    placeholder="San Francisco, CA"
                    value={addCity}
                    onChange={(e) => setAddCity(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Street Address
                  </label>
                  <input
                    type="text"
                    placeholder="123 Market Street, Suite 400"
                    value={addAddress}
                    onChange={(e) => setAddAddress(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Notes / Account Terms
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Preferred payment terms: Net 30, Enterprise account"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Customer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT CUSTOMER */}
      {/* ========================================================= */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Edit2 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Edit Customer</h2>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditCustomer} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Customer / Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    City / State
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Account Status
                  </label>
                  <select
                    value={editIsActive ? 'ACTIVE' : 'ARCHIVED'}
                    onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  >
                    <option value="ACTIVE">Active (Eligible for Orders)</option>
                    <option value="ARCHIVED">Archived (Deactivated)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Notes / Account Terms
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
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
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ARCHIVE CUSTOMER CONFIRMATION */}
      {/* ========================================================= */}
      {archivingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  {archivingCustomer.isActive ? 'Archive Customer' : 'Reactivate Customer'}
                </h2>
                <p className="text-[11px] text-muted-foreground">{archivingCustomer.name}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {archivingCustomer.isActive ? (
                <p>
                  Archiving this customer will deactivate the account. All past order histories and records will remain safely preserved.
                </p>
              ) : (
                <p>Reactivating this customer will make them available again for drafting orders.</p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setArchivingCustomer(null)}
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveCustomer}
                disabled={isPending}
                className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>{archivingCustomer.isActive ? 'Confirm Archive' : 'Confirm Reactivate'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
