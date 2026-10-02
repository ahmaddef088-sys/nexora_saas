import { Role } from '@prisma/client';

export interface AuditAuthDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a role is authorized to view workspace audit logs.
 * Strictly restricted to Workspace Owners and Admins.
 * Members and Viewers are denied access.
 */
export function canViewAuditLog(actorRole: Role): AuditAuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Access denied: Viewing workspace audit logs requires Admin or Owner role privileges.',
  };
}
