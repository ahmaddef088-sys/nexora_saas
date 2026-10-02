import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { canViewAuditLog } from '@/lib/auth/audit-auth';

describe('Audit RBAC Authorization — canViewAuditLog', () => {
  it('should allow OWNER to access audit logs', () => {
    const decision = canViewAuditLog(Role.OWNER);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it('should allow ADMIN to access audit logs', () => {
    const decision = canViewAuditLog(Role.ADMIN);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it('should deny MEMBER from accessing audit logs', () => {
    const decision = canViewAuditLog(Role.MEMBER);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeDefined();
    expect(decision.reason).toContain('requires Admin or Owner role');
  });

  it('should deny VIEWER from accessing audit logs', () => {
    const decision = canViewAuditLog(Role.VIEWER);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeDefined();
    expect(decision.reason).toContain('requires Admin or Owner role');
  });
});
