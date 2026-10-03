import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { Shield } from 'lucide-react';
import { Suspense } from 'react';

// Session-dependent (reads auth cookies): always render at request time, never at build time.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await auth();

  // If already authenticated, redirect to user's tenant dashboard
  if (session?.user?.tenantSlug) {
    redirect(`/${session.user.tenantSlug}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-2xl">
        {/* Header Branding */}
        <div className="space-y-3 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary mb-1">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In to Nexora</h1>
          <p className="text-xs text-muted-foreground">
            Enter your credentials to securely access your organization workspace
          </p>
        </div>

        {/* Interactive Login Form */}
        <Suspense fallback={<div className="text-center py-6 text-xs text-muted-foreground">Loading form...</div>}>
          <LoginForm />
        </Suspense>

        {/* Footer info */}
        <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border flex items-center justify-between">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Home
          </Link>
          <span className="text-[11px] text-muted-foreground/80">Nexora Business Suite v0.1</span>
        </div>
      </div>
    </div>
  );
}
