'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import {
  canCreateCustomer,
  canEditCustomer,
  canArchiveCustomer,
} from '@/lib/auth/order-auth';
import { recordAuditLog } from '@/lib/utils/audit';
import {
  createCustomerSchema,
  updateCustomerSchema,
  archiveCustomerSchema,
  CreateCustomerInput,
  UpdateCustomerInput,
  ArchiveCustomerInput,
} from '@/lib/validations/order';

export interface CustomerActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Create a new customer record scoped strictly to the verified workspace tenant.
 */
export async function createCustomerAction(
  orgSlug: string,
  input: CreateCustomerInput
): Promise<CustomerActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCreateCustomer(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to create customers.',
      };
    }

    const parsed = createCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid customer input data.',
      };
    }

    const { name, email, phone, companyName, address, city, notes } = parsed.data;

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenantContext.tenantId,
        name,
        email: email && email.trim() !== '' ? email.trim() : null,
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        companyName: companyName && companyName.trim() !== '' ? companyName.trim() : null,
        address: address && address.trim() !== '' ? address.trim() : null,
        city: city && city.trim() !== '' ? city.trim() : null,
        notes: notes && notes.trim() !== '' ? notes.trim() : null,
        isActive: true,
      },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'CUSTOMER_CREATED',
      entity: 'CUSTOMER',
      entityId: customer.id,
      metadata: { name, email, phone, companyName },
    });

    revalidatePath(`/${orgSlug}/customers`);
    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: `Customer "${name}" created successfully.`,
      data: customer,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create customer.',
    };
  }
}

/**
 * Update an existing customer record within the verified tenant.
 */
export async function updateCustomerAction(
  orgSlug: string,
  input: UpdateCustomerInput
): Promise<CustomerActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canEditCustomer(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to edit customers.',
      };
    }

    const parsed = updateCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid customer input data.',
      };
    }

    const { customerId, name, email, phone, companyName, address, city, notes } =
      parsed.data;

    // Strict tenant scoping check
    const targetCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!targetCustomer) {
      return {
        success: false,
        error: 'Customer record not found in this workspace.',
      };
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: targetCustomer.id },
      data: {
        name,
        email: email && email.trim() !== '' ? email.trim() : null,
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        companyName: companyName && companyName.trim() !== '' ? companyName.trim() : null,
        address: address && address.trim() !== '' ? address.trim() : null,
        city: city && city.trim() !== '' ? city.trim() : null,
        notes: notes && notes.trim() !== '' ? notes.trim() : null,
        // isActive is intentionally excluded: active/archived status must be
        // changed exclusively through archiveCustomerAction to preserve the
        // archive-only contract and historical order integrity.
      },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMER',
      entityId: targetCustomer.id,
      metadata: { name, email, phone, companyName },
    });

    revalidatePath(`/${orgSlug}/customers`);
    revalidatePath(`/${orgSlug}/orders`);

    return {
      success: true,
      message: `Customer "${name}" updated successfully.`,
      data: updatedCustomer,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update customer.',
    };
  }
}

/**
 * Archive / Deactivate or reactivate a customer record.
 */
export async function archiveCustomerAction(
  orgSlug: string,
  input: ArchiveCustomerInput
): Promise<CustomerActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canArchiveCustomer(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to archive customers.',
      };
    }

    const parsed = archiveCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input data.',
      };
    }

    const { customerId, isActive } = parsed.data;

    const targetCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!targetCustomer) {
      return {
        success: false,
        error: 'Customer record not found in this workspace.',
      };
    }

    const newStatus = isActive !== undefined ? isActive : !targetCustomer.isActive;

    const updated = await prisma.customer.update({
      where: { id: targetCustomer.id },
      data: { isActive: newStatus },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'CUSTOMER_ARCHIVED',
      entity: 'CUSTOMER',
      entityId: targetCustomer.id,
      metadata: { customerName: targetCustomer.name, isActive: newStatus },
    });

    revalidatePath(`/${orgSlug}/customers`);

    return {
      success: true,
      message: `Customer "${targetCustomer.name}" is now ${newStatus ? 'active' : 'archived'}.`,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update customer status.',
    };
  }
}
