import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export interface LogAuditOptions {
  tenantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
  throwOnError?: boolean;
}

/**
 * Server-side helper to record an immutable audit log entry.
 *
 * Supports both standalone execution (via default prisma client)
 * and transactional execution (via tx).
 *
 * @param options - Audit log entry parameters
 */
export async function recordAuditLog(options: LogAuditOptions): Promise<void> {
  const {
    tenantId,
    userId,
    action,
    entity,
    entityId,
    metadata,
    ipAddress,
    userAgent,
    tx,
    throwOnError = false,
  } = options;

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    const err = new Error('AuditLog failure: tenantId is required for tenant isolation');
    if (throwOnError) throw err;
    console.error(err.message);
    return;
  }

  const client = tx || prisma;

  try {
    // Sanitize metadata to prevent storing sensitive values (passwords, tokens, secrets)
    let sanitizedMetadata: Prisma.InputJsonValue | undefined = undefined;
    if (metadata && typeof metadata === 'object') {
      const copy = { ...(metadata as Record<string, unknown>) };
      const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'apiKey', 'creditCard'];
      for (const key of Object.keys(copy)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
          copy[key] = '[REDACTED]';
        }
      }
      sanitizedMetadata = copy as unknown as Prisma.InputJsonValue;
    }

    await client.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        metadata: sanitizedMetadata,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    if (throwOnError) {
      throw error;
    }
  }
}
