import { Role } from '@prisma/client';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      tenantSlug?: string;
      role?: Role;
      // Backward compatibility aliases
      organizationId?: string;
      organizationSlug?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    role?: Role;
    // Backward compatibility aliases
    organizationId?: string;
    organizationSlug?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    tenantId?: string;
    tenantSlug?: string;
    role?: Role;
    // Backward compatibility aliases
    organizationId?: string;
    organizationSlug?: string;
  }
}
