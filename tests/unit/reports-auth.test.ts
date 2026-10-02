import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { canViewReports } from '@/lib/auth/reports-auth';

describe('Reports RBAC Authorization — canViewReports', () => {
  it('should allow OWNER to view reports', () => {
    const decision = canViewReports(Role.OWNER);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it('should allow ADMIN to view reports', () => {
    const decision = canViewReports(Role.ADMIN);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it('should allow MEMBER to view reports', () => {
    const decision = canViewReports(Role.MEMBER);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it('should allow VIEWER to view reports', () => {
    const decision = canViewReports(Role.VIEWER);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });
});
