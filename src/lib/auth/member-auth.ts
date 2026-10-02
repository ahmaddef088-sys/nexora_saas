import { Role, MembershipStatus } from '@prisma/client';

export interface AuthDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a role can view members in the tenant workspace.
 * All verified tenant members (OWNER, ADMIN, MEMBER, VIEWER) have view permission for their own workspace.
 */
export function canViewMembers(actorRole: Role): boolean {
  return [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER].includes(actorRole);
}

/**
 * Check if an actor role is authorized to add a member with a specific target role.
 *
 * Rules:
 * - OWNER can add members with any role (OWNER, ADMIN, MEMBER, VIEWER).
 * - ADMIN can add MEMBER or VIEWER (cannot add OWNER or ADMIN).
 * - MEMBER / VIEWER cannot add members.
 */
export function canAddMember(actorRole: Role, targetRole: Role): AuthDecision {
  if (actorRole === Role.OWNER) {
    return { allowed: true };
  }

  if (actorRole === Role.ADMIN) {
    if (targetRole === Role.OWNER) {
      return { allowed: false, reason: 'Administrators cannot assign the OWNER role.' };
    }
    if (targetRole === Role.ADMIN) {
      return { allowed: false, reason: 'Administrators cannot create another Administrator.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'You do not have permission to add new members.' };
}

/**
 * Check if an actor role can change a target member's role.
 *
 * Rules:
 * - OWNER can change any member's role (except self-demotion if the last remaining active OWNER).
 * - ADMIN can only promote/demote between MEMBER and VIEWER.
 *   - Cannot change an OWNER's role.
 *   - Cannot change an ADMIN's role.
 *   - Cannot promote anyone to ADMIN or OWNER.
 * - MEMBER / VIEWER cannot change roles.
 */
export function canChangeMemberRole(
  actorRole: Role,
  currentTargetRole: Role,
  newTargetRole: Role,
  isSelf: boolean,
  isLastOwner: boolean
): AuthDecision {
  if (actorRole === Role.MEMBER || actorRole === Role.VIEWER) {
    return { allowed: false, reason: 'Members do not have permission to modify roles.' };
  }

  // Prevent leaving the tenant without an OWNER
  if (isSelf && currentTargetRole === Role.OWNER && newTargetRole !== Role.OWNER && isLastOwner) {
    return {
      allowed: false,
      reason: 'Cannot demote the only remaining Owner. Promote another member to Owner first.',
    };
  }

  if (actorRole === Role.OWNER) {
    return { allowed: true };
  }

  if (actorRole === Role.ADMIN) {
    if (currentTargetRole === Role.OWNER) {
      return { allowed: false, reason: 'Administrators cannot modify an Owner’s role.' };
    }
    if (currentTargetRole === Role.ADMIN && !isSelf) {
      return { allowed: false, reason: 'Administrators cannot modify another Administrator’s role.' };
    }
    if (newTargetRole === Role.OWNER) {
      return { allowed: false, reason: 'Administrators cannot promote members to Owner.' };
    }
    if (newTargetRole === Role.ADMIN) {
      return { allowed: false, reason: 'Administrators cannot promote members to Administrator.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized role modification.' };
}

/**
 * Check if an actor role can remove or deactivate a target member.
 *
 * Rules:
 * - Cannot remove the last active OWNER.
 * - OWNER can remove anyone (except self if last active OWNER).
 * - ADMIN can remove MEMBER and VIEWER.
 *   - Cannot remove OWNER.
 *   - Cannot remove another ADMIN.
 * - MEMBER / VIEWER cannot remove anyone.
 */
export function canRemoveMember(
  actorRole: Role,
  targetRole: Role,
  isSelf: boolean,
  isLastOwner: boolean
): AuthDecision {
  if (actorRole === Role.MEMBER || actorRole === Role.VIEWER) {
    return { allowed: false, reason: 'You do not have permission to remove members.' };
  }

  if (targetRole === Role.OWNER && isLastOwner) {
    return {
      allowed: false,
      reason: 'Cannot remove the last active Owner of the workspace.',
    };
  }

  if (actorRole === Role.OWNER) {
    return { allowed: true };
  }

  if (actorRole === Role.ADMIN) {
    if (targetRole === Role.OWNER) {
      return { allowed: false, reason: 'Administrators cannot remove an Owner.' };
    }
    if (targetRole === Role.ADMIN && !isSelf) {
      return { allowed: false, reason: 'Administrators cannot remove another Administrator.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized member removal.' };
}

/**
 * Check if an actor role can edit a target member's details (name / status).
 */
export function canEditMember(
  actorRole: Role,
  targetRole: Role,
  isSelf: boolean
): AuthDecision {
  if (isSelf) {
    return { allowed: true };
  }

  if (actorRole === Role.OWNER) {
    return { allowed: true };
  }

  if (actorRole === Role.ADMIN) {
    if (targetRole === Role.OWNER) {
      return { allowed: false, reason: 'Administrators cannot edit an Owner’s profile.' };
    }
    if (targetRole === Role.ADMIN) {
      return { allowed: false, reason: 'Administrators cannot edit another Administrator’s profile.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'You do not have permission to edit other members.' };
}
