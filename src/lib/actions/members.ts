'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import {
  canAddMember,
  canChangeMemberRole,
  canRemoveMember,
  canEditMember,
} from '@/lib/auth/member-auth';
import { recordAuditLog } from '@/lib/utils/audit';
import {
  addMemberSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
  updateMemberSchema,
  removeMemberSchema,
  AddMemberInput,
  UpdateMemberRoleInput,
  UpdateMemberStatusInput,
  UpdateMemberInput,
  RemoveMemberInput,
} from '@/lib/validations/member';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Add a member to the current tenant workspace.
 * Resolves verified tenant context server-side and checks RBAC permissions.
 */
export async function addMemberAction(
  orgSlug: string,
  input: AddMemberInput
): Promise<ActionResult> {
  try {
    // 1. Authenticate and resolve verified tenant context
    const tenantContext = await getRequiredTenantContext(orgSlug);

    // 2. Validate input schema
    const parsed = addMemberSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input parameters.',
      };
    }

    const { name, email, role } = parsed.data;

    // 3. Check server-side authorization
    const decision = canAddMember(tenantContext.role, role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to add this member.',
      };
    }

    // 4. Check if user already exists globally
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Check if membership already exists in THIS tenant
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId: tenantContext.tenantId,
          },
        },
      });

      if (existingMembership) {
        return {
          success: false,
          error: 'This user is already a member of this workspace.',
        };
      }

      // Add membership linking existing user to this tenant
      await prisma.membership.create({
        data: {
          userId: existingUser.id,
          tenantId: tenantContext.tenantId,
          role,
          status: 'ACTIVE',
        },
      });
    } else {
      // User does not exist globally -> Create user with safe development seed password and membership
      const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
      const passwordHash = await hashPassword(defaultPassword);

      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            emailVerified: new Date(),
          },
        });

        await tx.membership.create({
          data: {
            userId: newUser.id,
            tenantId: tenantContext.tenantId,
            role,
            status: 'ACTIVE',
          },
        });
      });
    }

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'MEMBER_CREATED',
      entity: 'MEMBER',
      entityId: existingUser?.id,
      metadata: { name, email, role },
    });

    revalidatePath(`/${orgSlug}/users`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: `Member ${name} (${email}) has been added as ${role}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred while adding the member.',
    };
  }
}

/**
 * Change a member's role in the current tenant workspace.
 */
export async function updateMemberRoleAction(
  orgSlug: string,
  input: UpdateMemberRoleInput
): Promise<ActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input parameters.',
      };
    }

    const { membershipId, role: newRole } = parsed.data;

    // Strict tenant isolation: Query membership strictly filtered by tenantId
    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        tenantId: tenantContext.tenantId,
      },
      include: {
        user: true,
      },
    });

    if (!targetMembership) {
      return {
        success: false,
        error: 'Member record not found in this workspace.',
      };
    }

    const isSelf = targetMembership.userId === tenantContext.userId;

    // Check active owners in this tenant
    const activeOwnerCount = await prisma.membership.count({
      where: {
        tenantId: tenantContext.tenantId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const isLastOwner = targetMembership.role === 'OWNER' && activeOwnerCount <= 1;

    const decision = canChangeMemberRole(
      tenantContext.role,
      targetMembership.role,
      newRole,
      isSelf,
      isLastOwner
    );

    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to modify this member role.',
      };
    }

    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'MEMBER_ROLE_CHANGED',
      entity: 'MEMBER',
      entityId: targetMembership.userId,
      metadata: {
        previousRole: targetMembership.role,
        newRole,
        memberName: targetMembership.user.name,
        memberEmail: targetMembership.user.email,
      },
    });

    revalidatePath(`/${orgSlug}/users`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: `Role for ${targetMembership.user.name || targetMembership.user.email} updated to ${newRole}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred while updating the role.',
    };
  }
}

/**
 * Update a member's status (ACTIVE, SUSPENDED, INVITED).
 */
export async function updateMemberStatusAction(
  orgSlug: string,
  input: UpdateMemberStatusInput
): Promise<ActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const parsed = updateMemberStatusSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input parameters.',
      };
    }

    const { membershipId, status } = parsed.data;

    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        tenantId: tenantContext.tenantId,
      },
      include: { user: true },
    });

    if (!targetMembership) {
      return {
        success: false,
        error: 'Member record not found in this workspace.',
      };
    }

    const isSelf = targetMembership.userId === tenantContext.userId;

    const activeOwnerCount = await prisma.membership.count({
      where: {
        tenantId: tenantContext.tenantId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const isLastOwner = targetMembership.role === 'OWNER' && activeOwnerCount <= 1;

    // Suspending the last active OWNER is prohibited
    if (status === 'SUSPENDED' && isLastOwner) {
      return {
        success: false,
        error: 'Cannot suspend the only remaining active Owner in the workspace.',
      };
    }

    const decision = canRemoveMember(
      tenantContext.role,
      targetMembership.role,
      isSelf,
      isLastOwner
    );

    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to update this member status.',
      };
    }

    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: { status },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'MEMBER_STATUS_CHANGED',
      entity: 'MEMBER',
      entityId: targetMembership.userId,
      metadata: {
        previousStatus: targetMembership.status,
        newStatus: status,
        memberEmail: targetMembership.user.email,
      },
    });

    revalidatePath(`/${orgSlug}/users`);

    return {
      success: true,
      message: `Status updated to ${status}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred while updating status.',
    };
  }
}

/**
 * Edit member details (Name, Role, Status) in a single unified mutation.
 */
export async function updateMemberAction(
  orgSlug: string,
  input: UpdateMemberInput
): Promise<ActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const parsed = updateMemberSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input parameters.',
      };
    }

    const { membershipId, name, role: newRole, status: newStatus } = parsed.data;

    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        tenantId: tenantContext.tenantId,
      },
      include: { user: true },
    });

    if (!targetMembership) {
      return {
        success: false,
        error: 'Member record not found in this workspace.',
      };
    }

    const isSelf = targetMembership.userId === tenantContext.userId;

    const activeOwnerCount = await prisma.membership.count({
      where: {
        tenantId: tenantContext.tenantId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const isLastOwner = targetMembership.role === 'OWNER' && activeOwnerCount <= 1;

    // Check general edit permission
    const editDecision = canEditMember(tenantContext.role, targetMembership.role, isSelf);
    if (!editDecision.allowed) {
      return {
        success: false,
        error: editDecision.reason || 'You are not authorized to edit this member.',
      };
    }

    // If role is being modified, verify role change permission
    if (newRole && newRole !== targetMembership.role) {
      const roleDecision = canChangeMemberRole(
        tenantContext.role,
        targetMembership.role,
        newRole,
        isSelf,
        isLastOwner
      );
      if (!roleDecision.allowed) {
        return {
          success: false,
          error: roleDecision.reason || 'Unauthorized role modification.',
        };
      }
    }

    // If status is being suspended, ensure not last owner
    if (newStatus && newStatus === 'SUSPENDED' && isLastOwner) {
      return {
        success: false,
        error: 'Cannot suspend the only remaining active Owner.',
      };
    }

    await prisma.$transaction(async (tx) => {
      if (name && name !== targetMembership.user.name) {
        await tx.user.update({
          where: { id: targetMembership.userId },
          data: { name },
        });
      }

      if ((newRole && newRole !== targetMembership.role) || (newStatus && newStatus !== targetMembership.status)) {
        await tx.membership.update({
          where: { id: targetMembership.id },
          data: {
            ...(newRole ? { role: newRole } : {}),
            ...(newStatus ? { status: newStatus } : {}),
          },
        });
      }
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'MEMBER_PROFILE_UPDATED',
      entity: 'MEMBER',
      entityId: targetMembership.userId,
      metadata: {
        name,
        role: newRole,
        status: newStatus,
        memberEmail: targetMembership.user.email,
      },
    });

    revalidatePath(`/${orgSlug}/users`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: 'Member details updated successfully.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred while updating member details.',
    };
  }
}

/**
 * Remove a member from the current workspace.
 * Deletes the Membership record while preserving the User globally.
 */
export async function removeMemberAction(
  orgSlug: string,
  input: RemoveMemberInput
): Promise<ActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input parameters.',
      };
    }

    const { membershipId } = parsed.data;

    // Strict tenant isolation
    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        tenantId: tenantContext.tenantId,
      },
      include: { user: true },
    });

    if (!targetMembership) {
      return {
        success: false,
        error: 'Member record not found in this workspace.',
      };
    }

    const isSelf = targetMembership.userId === tenantContext.userId;

    const activeOwnerCount = await prisma.membership.count({
      where: {
        tenantId: tenantContext.tenantId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const isLastOwner = targetMembership.role === 'OWNER' && activeOwnerCount <= 1;

    const decision = canRemoveMember(
      tenantContext.role,
      targetMembership.role,
      isSelf,
      isLastOwner
    );

    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to remove this member.',
      };
    }

    // Delete membership linking user to this tenant
    await prisma.membership.delete({
      where: { id: targetMembership.id },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'MEMBER_REMOVED',
      entity: 'MEMBER',
      entityId: targetMembership.userId,
      metadata: {
        memberName: targetMembership.user.name,
        memberEmail: targetMembership.user.email,
        role: targetMembership.role,
      },
    });

    revalidatePath(`/${orgSlug}/users`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: `Member ${targetMembership.user.name || targetMembership.user.email} removed from this workspace.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred while removing the member.',
    };
  }
}
