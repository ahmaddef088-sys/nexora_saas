import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'healthy';
  try {
    // Lightweight liveness ping against database
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = 'unreachable';
  }

  const isHealthy = dbStatus === 'healthy';

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      service: 'Nexora Business Suite API',
      version: '0.1.0',
    },
    { status: isHealthy ? 200 : 503 }
  );
}
