import { Role } from '@prisma/client';
import { hasPermission } from './permissions';

export interface ReportsAuthDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a role is authorized to view workspace reports and analytics.
 * Gated by 'reports:read' permission (granted to OWNER, ADMIN, MEMBER, VIEWER).
 */
export function canViewReports(actorRole: Role): ReportsAuthDecision {
  if (hasPermission(actorRole, 'reports:read')) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Access denied: You do not have permission to view reports in this workspace.',
  };
}
