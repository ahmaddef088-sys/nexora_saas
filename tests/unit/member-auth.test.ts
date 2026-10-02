import { describe, it, expect } from 'vitest';
import { Role, MembershipStatus } from '@prisma/client';
import {
  canViewMembers,
  canAddMember,
  canChangeMemberRole,
  canRemoveMember,
  canEditMember,
} from '../../src/lib/auth/member-auth';
import {
  addMemberSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
  updateMemberSchema,
  removeMemberSchema,
} from '../../src/lib/validations/member';

describe('Member Authorization & RBAC Matrix Tests', () => {
  describe('canViewMembers', () => {
    it('allows all verified roles to view members of their tenant', () => {
      expect(canViewMembers(Role.OWNER)).toBe(true);
      expect(canViewMembers(Role.ADMIN)).toBe(true);
      expect(canViewMembers(Role.MEMBER)).toBe(true);
      expect(canViewMembers(Role.VIEWER)).toBe(true);
    });
  });

  describe('canAddMember', () => {
    it('allows OWNER to add any role', () => {
      expect(canAddMember(Role.OWNER, Role.OWNER).allowed).toBe(true);
      expect(canAddMember(Role.OWNER, Role.ADMIN).allowed).toBe(true);
      expect(canAddMember(Role.OWNER, Role.MEMBER).allowed).toBe(true);
      expect(canAddMember(Role.OWNER, Role.VIEWER).allowed).toBe(true);
    });

    it('allows ADMIN to add only MEMBER or VIEWER roles', () => {
      expect(canAddMember(Role.ADMIN, Role.MEMBER).allowed).toBe(true);
      expect(canAddMember(Role.ADMIN, Role.VIEWER).allowed).toBe(true);

      // Escalation protection
      const addOwner = canAddMember(Role.ADMIN, Role.OWNER);
      expect(addOwner.allowed).toBe(false);
      expect(addOwner.reason).toContain('Administrators cannot assign the OWNER role');

      const addAdmin = canAddMember(Role.ADMIN, Role.ADMIN);
      expect(addAdmin.allowed).toBe(false);
      expect(addAdmin.reason).toContain('Administrators cannot create another Administrator');
    });

    it('rejects MEMBER and VIEWER from adding members', () => {
      expect(canAddMember(Role.MEMBER, Role.MEMBER).allowed).toBe(false);
      expect(canAddMember(Role.VIEWER, Role.VIEWER).allowed).toBe(false);
    });
  });

  describe('canChangeMemberRole', () => {
    it('allows OWNER to change roles between all levels when not last owner', () => {
      expect(canChangeMemberRole(Role.OWNER, Role.MEMBER, Role.ADMIN, false, false).allowed).toBe(true);
      expect(canChangeMemberRole(Role.OWNER, Role.ADMIN, Role.OWNER, false, false).allowed).toBe(true);
      expect(canChangeMemberRole(Role.OWNER, Role.OWNER, Role.ADMIN, false, false).allowed).toBe(true);
    });

    it('prevents OWNER from demoting themselves if they are the sole active OWNER', () => {
      const decision = canChangeMemberRole(Role.OWNER, Role.OWNER, Role.ADMIN, true, true);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Cannot demote the only remaining Owner');
    });

    it('allows OWNER to demote themselves if there are other active OWNERs', () => {
      const decision = canChangeMemberRole(Role.OWNER, Role.OWNER, Role.ADMIN, true, false);
      expect(decision.allowed).toBe(true);
    });

    it('allows ADMIN to promote/demote between MEMBER and VIEWER only', () => {
      expect(canChangeMemberRole(Role.ADMIN, Role.MEMBER, Role.VIEWER, false, false).allowed).toBe(true);
      expect(canChangeMemberRole(Role.ADMIN, Role.VIEWER, Role.MEMBER, false, false).allowed).toBe(true);

      // Escalation / Privilege protection
      expect(canChangeMemberRole(Role.ADMIN, Role.MEMBER, Role.ADMIN, false, false).allowed).toBe(false);
      expect(canChangeMemberRole(Role.ADMIN, Role.MEMBER, Role.OWNER, false, false).allowed).toBe(false);
      expect(canChangeMemberRole(Role.ADMIN, Role.ADMIN, Role.MEMBER, false, false).allowed).toBe(false);
      expect(canChangeMemberRole(Role.ADMIN, Role.OWNER, Role.MEMBER, false, false).allowed).toBe(false);
    });

    it('rejects MEMBER and VIEWER from changing roles', () => {
      expect(canChangeMemberRole(Role.MEMBER, Role.VIEWER, Role.MEMBER, false, false).allowed).toBe(false);
      expect(canChangeMemberRole(Role.VIEWER, Role.MEMBER, Role.VIEWER, false, false).allowed).toBe(false);
    });
  });

  describe('canRemoveMember', () => {
    it('prevents removing the last active OWNER', () => {
      const decision = canRemoveMember(Role.OWNER, Role.OWNER, true, true);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Cannot remove the last active Owner');
    });

    it('allows OWNER to remove any non-last-owner member', () => {
      expect(canRemoveMember(Role.OWNER, Role.ADMIN, false, false).allowed).toBe(true);
      expect(canRemoveMember(Role.OWNER, Role.MEMBER, false, false).allowed).toBe(true);
      expect(canRemoveMember(Role.OWNER, Role.VIEWER, false, false).allowed).toBe(true);
    });

    it('allows ADMIN to remove only MEMBER or VIEWER', () => {
      expect(canRemoveMember(Role.ADMIN, Role.MEMBER, false, false).allowed).toBe(true);
      expect(canRemoveMember(Role.ADMIN, Role.VIEWER, false, false).allowed).toBe(true);

      expect(canRemoveMember(Role.ADMIN, Role.OWNER, false, false).allowed).toBe(false);
      expect(canRemoveMember(Role.ADMIN, Role.ADMIN, false, false).allowed).toBe(false);
    });

    it('rejects MEMBER and VIEWER from removing members', () => {
      expect(canRemoveMember(Role.MEMBER, Role.MEMBER, false, false).allowed).toBe(false);
      expect(canRemoveMember(Role.VIEWER, Role.VIEWER, false, false).allowed).toBe(false);
    });
  });

  describe('canEditMember', () => {
    it('allows any user to edit their own profile name', () => {
      expect(canEditMember(Role.MEMBER, Role.MEMBER, true).allowed).toBe(true);
      expect(canEditMember(Role.VIEWER, Role.VIEWER, true).allowed).toBe(true);
    });

    it('allows OWNER to edit other members', () => {
      expect(canEditMember(Role.OWNER, Role.ADMIN, false).allowed).toBe(true);
      expect(canEditMember(Role.OWNER, Role.MEMBER, false).allowed).toBe(true);
    });

    it('allows ADMIN to edit MEMBER and VIEWER, but not OWNER or another ADMIN', () => {
      expect(canEditMember(Role.ADMIN, Role.MEMBER, false).allowed).toBe(true);
      expect(canEditMember(Role.ADMIN, Role.VIEWER, false).allowed).toBe(true);
      expect(canEditMember(Role.ADMIN, Role.OWNER, false).allowed).toBe(false);
      expect(canEditMember(Role.ADMIN, Role.ADMIN, false).allowed).toBe(false);
    });
  });
});

describe('Member Validation Schemas', () => {
  it('validates correct AddMemberInput', () => {
    const res = addMemberSchema.safeParse({
      name: 'Sarah Connor',
      email: 'sarah@acme.com',
      role: Role.MEMBER,
    });
    expect(res.success).toBe(true);
  });

  it('rejects invalid email on AddMemberInput', () => {
    const res = addMemberSchema.safeParse({
      name: 'Sarah Connor',
      email: 'not-an-email',
      role: Role.MEMBER,
    });
    expect(res.success).toBe(false);
  });

  it('rejects short name on AddMemberInput', () => {
    const res = addMemberSchema.safeParse({
      name: 'A',
      email: 'sarah@acme.com',
      role: Role.MEMBER,
    });
    expect(res.success).toBe(false);
  });

  it('validates UpdateMemberRoleInput', () => {
    const res = updateMemberRoleSchema.safeParse({
      membershipId: 'mem_123',
      role: Role.ADMIN,
    });
    expect(res.success).toBe(true);
  });

  it('validates UpdateMemberStatusInput', () => {
    const res = updateMemberStatusSchema.safeParse({
      membershipId: 'mem_123',
      status: MembershipStatus.SUSPENDED,
    });
    expect(res.success).toBe(true);
  });
});
