import Link from 'next/link';
import { auth } from '@/lib/auth';
import { ShieldCheck, ArrowRight, LogIn, LayoutDashboard } from 'lucide-react';

// Session-dependent (reads auth cookies): always render at request time, never at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth();
  const targetTenantSlug = session?.user?.tenantSlug || 'acme-corp';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center space-x-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck className="h-4 w-4" />
          <span>Enterprise Multi-Tenant SaaS Platform</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Nexora Business Suite
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Secure, scalable, and modular multi-tenant Business Management Platform foundation built with Next.js App Router, TypeScript, NextAuth v5, and Prisma ORM.
        </p>

        {session?.user ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 max-w-md mx-auto space-y-3">
            <div className="text-xs text-muted-foreground">
              Signed in as <strong className="text-foreground">{session.user.email}</strong> ({session.user.role || 'MEMBER'})
            </div>
            <div className="flex justify-center gap-3">
              <Link
                href={`/${targetTenantSlug}`}
                className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Go to Dashboard (/{targetTenantSlug})</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span>تسجيل الدخول / Sign In</span>
            </Link>
            <Link
              href="/acme-corp"
              className="inline-flex items-center space-x-1.5 rounded-md border border-input bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <span>Demo Workspace (/acme-corp)</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
