import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton (server-only).
 *
 * The client is created lazily on first property access instead of at module
 * import time. This guarantees that merely importing this module (e.g. while
 * Next.js collects page data during `next build`, or when the module ends up
 * in a route's import graph) never constructs a PrismaClient or opens a
 * database connection. Queries — and therefore connections — only happen at
 * request time.
 *
 * The connection string is read by Prisma from `process.env.DATABASE_URL`
 * (see `prisma/schema.prisma`); it is never hardcoded here.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // Cached on globalThis in every environment: prevents connection storms from
    // HMR in development and reuses the client across warm serverless invocations.
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
