import { prisma } from './prisma';

/**
 * Tenant-scoped Prisma database client wrapper.
 * Enforces row-level isolation by automatically binding tenantId.
 *
 * @param tenantId - Verified tenant/organization ID for the active tenant context
 */
export function getTenantDb(tenantId: string) {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Tenant isolation failure: Missing or invalid tenantId');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // List of models that belong to a tenant
          const tenantModels = [
            'AuditLog',
            'Category',
            'Product',
            'Inventory',
            'InventoryMovement',
            'Order',
            'Customer',
            'Invoice',
            'Payment',
            'Expense',
            'LedgerEntry',
          ];

          if (tenantModels.includes(model)) {
            const typedArgs = (args || {}) as Record<string, unknown>;

            // Enforce tenantId filter on read/update/delete operations
            if (
              [
                'findUnique',
                'findFirst',
                'findMany',
                'count',
                'update',
                'updateMany',
                'delete',
                'deleteMany',
              ].includes(operation)
            ) {
              typedArgs.where = {
                ...(typedArgs.where as Record<string, unknown> | undefined),
                tenantId,
              };
            }

            // Enforce tenantId on create operations
            if (['create'].includes(operation)) {
              typedArgs.data = {
                ...(typedArgs.data as Record<string, unknown> | undefined),
                tenantId,
              };
            }

            if (['createMany'].includes(operation) && Array.isArray(typedArgs.data)) {
              typedArgs.data = typedArgs.data.map((item: Record<string, unknown>) => ({
                ...item,
                tenantId,
              }));
            }
          }

          return query(args);
        },
      },
    },
  });
}
