import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required in production').optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  SEED_DEFAULT_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and retrieve environment configuration safely.
 */
export function getEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    // In production, throw clear error without leaking sensitive values
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('Invalid environment configuration in production:', JSON.stringify(formatted, null, 2));
      throw new Error('Environment configuration validation failed. Please check production environment variables.');
    }
  }

  return result.success ? result.data : (process.env as unknown as Env);
}
