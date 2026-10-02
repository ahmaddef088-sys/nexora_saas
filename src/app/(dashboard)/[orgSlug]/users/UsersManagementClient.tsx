'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, MembershipStatus } from '@prisma/client';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MoreVertical,
  Edit2,
  Trash2,
  KeyRound,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  UserX,
  AlertTriangle,
} from 'lucide-react';
import {
  addMemberAction,
  updateMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from '@/lib/actions/members';
import {
  canAddMember,
  canChangeMemberRole,
  canRemoveMember,
  canEditMember,
} from '@/lib/auth/member-auth';

export interface SerializedMember {
  id: string;
  role: Role;
  status: MembershipStatus;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface UsersManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserId: string;
  currentUserRole: Role;
  members: SerializedMember[];
}

export function UsersManagementClient({
  orgSlug,
  tenantName,
  currentUserId,
  currentUserRole,
  members,
}: UsersManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SerializedMember | null>(null);
  const [roleChangeMember, setRoleChangeMember] = useState<SerializedMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<SerializedMember | null>(null);

  // Form States for Add Member
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<Role>(Role.MEMBER);

  // Form States for Edit Member
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>(Role.MEMBER);
  const [editStatus, setEditStatus] = useState<MembershipStatus>(MembershipStatus.ACTIVE);

  // Form State for Quick Role Change
  const [quickNewRole, setQuickNewRole] = useState<Role>(Role.MEMBER);

  // Filtered members list
  const filteredMembers = members.filter((member) => {
    const nameMatch = member.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    const emailMatch = member.user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = searchQuery === '' || nameMatch || emailMatch;
    const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate active owner count
  const activeOwnerCount = members.filter((m) => m.role === Role.OWNER && m.status === MembershipStatus.ACTIVE).length;

  // Role summary stats
  const stats = {
    total: members.length,
    owners: members.filter((m) => m.role === Role.OWNER).length,
    admins: members.filter((m) => m.role === Role.ADMIN).length,
    members: members.filter((m) => m.role === Role.MEMBER).length,
    viewers: members.filter((m) => m.role === Role.VIEWER).length,
  };

  const isCallerPrivileged = currentUserRole === Role.OWNER || currentUserRole === Role.ADMIN;

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await addMemberAction(orgSlug, {
        name: addName.trim(),
        email: addEmail.trim(),
        role: addRole,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Member added successfully.' });
        setIsAddModalOpen(false);
        setAddName('');
        setAddEmail('');
        setAddRole(Role.MEMBER);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to add member.' });
      }
    });
  };

  // Handle Edit Member
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await updateMemberAction(orgSlug, {
        membershipId: editingMember.id,
        name: editName.trim(),
        role: editRole,
        status: editStatus,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Member updated successfully.' });
        setEditingMember(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update member.' });
      }
    });
  };

  // Handle Role Change
  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleChangeMember) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await updateMemberRoleAction(orgSlug, {
        membershipId: roleChangeMember.id,
        role: quickNewRole,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Role updated successfully.' });
        setRoleChangeMember(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update role.' });
      }
    });
  };

  // Handle Remove Member
  const handleRemoveMember = async () => {
    if (!deletingMember) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await removeMemberAction(orgSlug, {
        membershipId: deletingMember.id,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Member removed successfully.' });
        setDeletingMember(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to remove member.' });
      }
    });
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case Role.OWNER:
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            <ShieldAlert className="h-3 w-3" />
            <span>OWNER</span>
          </span>
        );
      case Role.ADMIN:
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
            <ShieldCheck className="h-3 w-3" />
            <span>ADMIN</span>
          </span>
        );
      case Role.MEMBER:
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <Shield className="h-3 w-3" />
            <span>MEMBER</span>
          </span>
        );
      case Role.VIEWER:
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-slate-500/10 border border-slate-500/30 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
            <Shield className="h-3 w-3" />
            <span>VIEWER</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: MembershipStatus) => {
    switch (status) {
      case MembershipStatus.ACTIVE:
        return (
          <span className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        );
      case MembershipStatus.SUSPENDED:
        return (
          <span className="inline-flex items-center rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive border border-destructive/20">
            Suspended
          </span>
        );
      case MembershipStatus.INVITED:
        return (
          <span className="inline-flex items-center rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            Invited
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Feedback */}
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

      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Users & Roles</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {stats.total} {stats.total === 1 ? 'Member' : 'Members'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage authorized team members, workspace roles, and access status for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div>
          {isCallerPrivileged ? (
            <button
              id="add-member-btn"
              onClick={() => {
                setFeedback(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Member</span>
            </button>
          ) : (
            <div
              title="Only Owners and Administrators can add new members"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Add Member (Owner/Admin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Role Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Owners
          </div>
          <div className="text-xl font-bold text-amber-400">{stats.owners}</div>
          <div className="text-[10px] text-muted-foreground">Full workspace administration</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Admins
          </div>
          <div className="text-xl font-bold text-indigo-400">{stats.admins}</div>
          <div className="text-[10px] text-muted-foreground">Operational management</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Members
          </div>
          <div className="text-xl font-bold text-emerald-400">{stats.members}</div>
          <div className="text-[10px] text-muted-foreground">Standard business operations</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Viewers
          </div>
          <div className="text-xl font-bold text-slate-400">{stats.viewers}</div>
          <div className="text-[10px] text-muted-foreground">Read-only workspace access</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
      </div>

      {/* Member Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-xs">No workspace members found.</p>
                      {searchQuery && (
                        <p className="text-[11px] text-muted-foreground/75">
                          Try adjusting your search query or filters.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelf = member.user.id === currentUserId;
                  const isLastOwner = member.role === Role.OWNER && activeOwnerCount <= 1;

                  const canEdit = canEditMember(currentUserRole, member.role, isSelf).allowed;
                  const canChangeRole = canChangeMemberRole(
                    currentUserRole,
                    member.role,
                    Role.MEMBER, // dummy test
                    isSelf,
                    isLastOwner
                  ).allowed;
                  const canRemove = canRemoveMember(
                    currentUserRole,
                    member.role,
                    isSelf,
                    isLastOwner
                  ).allowed;

                  // Initials for avatar
                  const initials = member.user.name
                    ? member.user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : member.user.email.slice(0, 2).toUpperCase();

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      {/* User Info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                            {initials}
                          </div>
                          <div className="truncate">
                            <div className="font-medium text-foreground flex items-center space-x-1.5">
                              <span>{member.user.name || 'Unnamed User'}</span>
                              {isSelf && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {member.user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getRoleBadge(member.role)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(member.status)}
                      </td>

                      {/* Joined Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground text-[11px]">
                        {new Date(member.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Change Role Button */}
                          <button
                            onClick={() => {
                              setRoleChangeMember(member);
                              setQuickNewRole(member.role);
                              setFeedback(null);
                            }}
                            disabled={!canChangeRole || isPending}
                            title={
                              !canChangeRole
                                ? 'You do not have permission to change this role'
                                : 'Change Member Role'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              canChangeRole
                                ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Details Button */}
                          <button
                            onClick={() => {
                              setEditingMember(member);
                              setEditName(member.user.name || '');
                              setEditRole(member.role);
                              setEditStatus(member.status);
                              setFeedback(null);
                            }}
                            disabled={!canEdit || isPending}
                            title={!canEdit ? 'You cannot edit this member' : 'Edit Member Details'}
                            className={`p-1.5 rounded-md transition-colors ${
                              canEdit
                                ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Remove Button */}
                          <button
                            onClick={() => {
                              setDeletingMember(member);
                              setFeedback(null);
                            }}
                            disabled={!canRemove || isPending}
                            title={
                              isLastOwner
                                ? 'Cannot remove the last active Owner'
                                : !canRemove
                                ? 'You do not have permission to remove this member'
                                : 'Remove Member from Workspace'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              canRemove
                                ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD MEMBER */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Add Member to Workspace</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Initial Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as Role)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  {currentUserRole === Role.OWNER && <option value="OWNER">Owner (Full Administration)</option>}
                  {currentUserRole === Role.OWNER && <option value="ADMIN">Admin (Operational Management)</option>}
                  <option value="MEMBER">Member (Standard Business Access)</option>
                  <option value="VIEWER">Viewer (Read-Only)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {addRole === Role.OWNER && 'Owners can manage billing, members, and all business modules.'}
                  {addRole === Role.ADMIN && 'Admins can manage standard members and daily operations.'}
                  {addRole === Role.MEMBER && 'Members can manage operational records without administrative access.'}
                  {addRole === Role.VIEWER && 'Viewers have read-only access across enabled modules.'}
                </p>
              </div>

              <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center space-x-1.5 font-medium text-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>Password / Authentication Strategy</span>
                </div>
                <p>
                  New users will be initialized with a secure development password (<code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">Password123!</code>) for immediate testing.
                </p>
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
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Member</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT MEMBER DETAILS */}
      {/* ========================================================= */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Edit2 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Edit Member Details</h2>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditMember} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email (Immutable)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingMember.user.email}
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Role Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  disabled={currentUserRole === Role.MEMBER || currentUserRole === Role.VIEWER}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground disabled:opacity-50"
                >
                  {currentUserRole === Role.OWNER && <option value="OWNER">Owner</option>}
                  {currentUserRole === Role.OWNER && <option value="ADMIN">Admin</option>}
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as MembershipStatus)}
                  disabled={currentUserRole === Role.MEMBER || currentUserRole === Role.VIEWER}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground disabled:opacity-50"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended (Blocked from Workspace)</option>
                  <option value="INVITED">Invited</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
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
      {/* MODAL 3: QUICK CHANGE ROLE */}
      {/* ========================================================= */}
      {roleChangeMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Change Member Role</h2>
              </div>
              <button
                onClick={() => setRoleChangeMember(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRoleChange} className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs">
                <div className="font-semibold text-foreground">
                  {roleChangeMember.user.name || roleChangeMember.user.email}
                </div>
                <div className="text-muted-foreground">{roleChangeMember.user.email}</div>
                <div className="text-[11px] text-muted-foreground pt-1 flex items-center space-x-1.5">
                  <span>Current Role:</span>
                  {getRoleBadge(roleChangeMember.role)}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Select New Role
                </label>
                <select
                  value={quickNewRole}
                  onChange={(e) => setQuickNewRole(e.target.value as Role)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  {currentUserRole === Role.OWNER && <option value="OWNER">Owner (Full Admin)</option>}
                  {currentUserRole === Role.OWNER && <option value="ADMIN">Admin (Operational Management)</option>}
                  <option value="MEMBER">Member (Standard Operations)</option>
                  <option value="VIEWER">Viewer (Read Only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleChangeMember(null)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || quickNewRole === roleChangeMember.role}
                  className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Role</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: REMOVE MEMBER CONFIRMATION */}
      {/* ========================================================= */}
      {deletingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Remove Member from Workspace</h2>
                <p className="text-[11px] text-muted-foreground">This action removes access to {tenantName}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                Are you sure you want to remove <strong className="text-foreground">{deletingMember.user.name || deletingMember.user.email}</strong> (<code className="text-primary font-mono text-[11px]">{deletingMember.user.email}</code>) from this workspace?
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                The user will immediately lose access to this tenant workspace. Their global Nexora identity will remain intact.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveMember}
                disabled={isPending}
                className="inline-flex items-center space-x-1.5 rounded-md bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <UserX className="h-3.5 w-3.5" />
                    <span>Confirm Removal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
