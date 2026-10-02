# End-to-End (E2E) Testing Architecture

Comprehensive browser-level end-to-end test suite for **Nexora Business Suite** built using Playwright.

---

## 1. Test Organization

```
tests/e2e/
├── helpers/
│   └── auth.ts           # Reusable auth fixtures, demo users, sign-in & sign-out helpers
├── auth.spec.ts          # Authentication flows & session redirection tests
├── tenancy.spec.ts       # Cross-tenant data isolation & direct URL manipulation tests (403 Forbidden)
├── rbac.spec.ts          # Role-Based Access Control matrix (OWNER, ADMIN, MEMBER, VIEWER)
├── users.spec.ts         # User management, member list, and role inspection
├── products.spec.ts      # Product catalog browsing and inventory control
├── customers.spec.ts     # Customer directory and search capabilities
├── orders.spec.ts        # Order lifecycle and KPI metrics
├── finance.spec.ts       # Invoicing, payments, expenses, receivables, and general ledger
├── reports.spec.ts       # Financial analytics, date range presets, and KPI metrics
└── audit.spec.ts         # Audit log stream and security event inspection
```

---

## 2. Seeded Demo Accounts & Credentials

| User Account | Role | Tenant | Email | Default Password |
|---|---|---|---|---|
| **Acme Admin** | `OWNER` | `acme-corp` | `admin@acme.com` | `Password123!` (or `SEED_DEFAULT_PASSWORD`) |
| **Alex Member** | `MEMBER` | `acme-corp` | `member@acme.com` | `Password123!` (or `SEED_DEFAULT_PASSWORD`) |
| **Globex Owner** | `OWNER` | `globex-corp` | `owner@globex.com` | `Password123!` (or `SEED_DEFAULT_PASSWORD`) |

---

## 3. Running E2E Tests

### Running all E2E tests:
```bash
npm run test:e2e
```

### Running a specific test suite:
```bash
npx playwright test tests/e2e/tenancy.spec.ts
```

### Running unit and integration tests:
```bash
npm run test
```

---

## 4. Multi-Tenant Isolation & Security Invariants Verified

- **Browser-Level Isolation**: Users logged into `acme-corp` attempting direct URL manipulation to `/globex-corp` or `/globex-corp/finance/*` are immediately blocked with a server-rendered `403 Forbidden` screen.
- **RBAC Server Verification**: Role permissions are verified server-side at the route layout and action handlers; hiding UI elements is never relied upon as security.
- **Append-Only Audit Stream**: Privileged audit logs are strictly restricted to `OWNER` and `ADMIN` roles.
