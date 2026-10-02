'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { loginSchema } from '@/lib/validations/auth';
import { Lock, Mail, AlertCircle, Loader2, KeyRound, Building2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/acme-corp';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || 'Please check your inputs.';
      setError(firstError);
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email address or password. Please try again.');
        setIsLoading(false);
        return;
      }

      // Successful login -> Redirect
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred during sign in. Please try again.');
      setIsLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-center space-x-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme.com"
              required
              disabled={isLoading}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>
        </div>

        <button
          id="submit-login-btn"
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            'Sign In to Workspace'
          )}
        </button>
      </form>

      {/* Demo Credentials Quick-Fill Helper for Development Testing */}
      <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <KeyRound className="h-3.5 w-3.5 text-primary" />
          <span>Development Demo Accounts</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Click any account below to autofill development credentials (Password: <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">Password123!</code>):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleQuickFill('admin@acme.com')}
            className="flex items-center space-x-2 text-left rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-foreground"
          >
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="truncate">
              <div className="font-medium text-[11px]">Acme Owner</div>
              <div className="text-[10px] text-muted-foreground truncate">admin@acme.com</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('member@acme.com')}
            className="flex items-center space-x-2 text-left rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-foreground"
          >
            <Building2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <div className="font-medium text-[11px]">Acme Member</div>
              <div className="text-[10px] text-muted-foreground truncate">member@acme.com</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('owner@globex.com')}
            className="flex items-center space-x-2 text-left rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-foreground sm:col-span-2"
          >
            <Building2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <div className="truncate">
              <div className="font-medium text-[11px]">Globex Owner (Cross-Tenant Test)</div>
              <div className="text-[10px] text-muted-foreground truncate">owner@globex.com</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
