# Nexora Business Suite — Multi-Tenant SaaS Platform

An enterprise-ready, production-quality multi-tenant SaaS Business Management Platform architected for strict data isolation, financial precision, and modular scalability.

---

## 1. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 14 (App Router, Server Actions & React Server Components) |
| **Language** | TypeScript 5 (Strict Mode) |
| **Styling** | Tailwind CSS & Modern UI Tokens |
| **Database** | PostgreSQL |
| **ORM** | Prisma ORM 5 with Tenant-Scoped Extensions |
| **Authentication** | Auth.js (NextAuth v5 Beta) |
| **Validation** | Zod 3 |
| **Unit & Integration Tests** | Vitest 2 |
| **End-to-End (E2E) Tests** | Playwright |
| **Continuous Integration** | GitHub Actions |

---

## 2. Core Business Modules Implemented

1. **Authentication & Sessions**: NextAuth v5 JWT session handling, secure bcrypt password hashing, and login redirects with callback preservation.
2. **Multi-Tenancy & Isolation**: Hard multi-tenant database scoping via `src/lib/db/tenant-db.ts` preventing cross-tenant access at the ORM layer.
3. **Users & Role-Based Access Control (RBAC)**: Fine-grained permissions across `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` roles.
4. **Product Catalog & Inventory**: SKU tracking, price/cost tracking, initial stock intake, and atomic stock movements (`STOCK_IN`, `STOCK_OUT`, `ADJUSTMENT`) with negative-stock prevention.
5. **Customer Management**: Contact directory, multi-tenant ownership, and customer archiving.
6. **Sales Orders & Fulfillment**: Order lifecycle (`DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `COMPLETED` / `CANCELLED`) with atomic inventory decrement locks upon confirmation and stock restoration upon cancellation.
7. **Financial Management Control Hub**:
   - **Invoices**: Order-to-invoice generation, draft editing, issuance, and voiding.
   - **Payments & Collections**: Payment recording, full invoice balance tracking, and owner-only refunds.
   - **Expenses**: Expense tracking, category allocation, and deletion reversals.
   - **Accounts Receivable (AR)**: Aging buckets (Current, 1–30, 31–60, 61–90, 90+ days) and collection status.
   - **General Ledger**: Append-only immutable financial audit ledger tracking `REVENUE` and `EXPENSE` entries.
8. **Reports & Analytics**: Executive KPI dashboards (Net Revenue, Gross Profit, AR aging, monthly trends) with UTC-safe date range filtering.
9. **Audit Logs & Security Stream**: Append-only audit stream with automated sensitive metadata redaction (`[REDACTED]`).

---

## 3. Environment Configuration

Copy the template file to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `PORT` | Web server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=public` |
| `NEXTAUTH_SECRET` | Secret key for Auth.js JWT signing | Generate via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical app URL | `http://localhost:3000` |
| `SEED_DEFAULT_PASSWORD` | Default password for seeded accounts | `Password123!` |

---

## 4. Database Workflows

### Local Development:
```bash
# Push schema changes directly during active feature prototyping
npm run db:push

# Or create a migration file
npm run db:migrate

# Seed demo tenants (Acme Corp & Globex Corp)
npm run db:seed
```

### Production Deployment:
```bash
# Generate Prisma Client
npm run db:generate

# Apply pending migrations safely without interactive prompts
npm run db:deploy
```

---

## 5. Available Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` |
| `npm run build` | Compiles optimized Next.js production build |
| `npm run start` | Runs the compiled Next.js production server |
| `npm run type-check` | Validates TypeScript types across the entire project (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint rules |
| `npm run format` | Formats all code with Prettier |
| `npm test` | Runs 329 unit and integration tests via Vitest |
| `npm run test:e2e` | Runs Playwright browser-level end-to-end tests |
| `npm run db:generate` | Generates the latest Prisma client |
| `npm run db:deploy` | Applies production migrations non-interactively |
| `npm run db:seed` | Seeds multi-tenant demo workspaces and test users |

---

## 6. Health & Liveness Endpoint

The application provides a production health check endpoint at:
`GET /api/health`

**Response Example (200 OK):**
```json
{
  "status": "ok",
  "database": "healthy",
  "timestamp": "2026-08-23T02:00:00.000Z",
  "service": "Nexora Business Suite API",
  "version": "0.1.0"
}
```

If the database is unreachable, the endpoint returns a `503 Service Unavailable` with `"database": "unreachable"` without leaking internal connection strings or error traces.

---

## 7. Production Deployment Lifecycle

1. **Provision Database**: PostgreSQL instance (ensure connection pool is configured).
2. **Set Environment Variables**: Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `NODE_ENV=production`.
3. **Build & Deploy**:
   ```bash
   npm ci
   npm run db:generate
   npm run db:deploy
   npm run build
   npm run start
   ```
4. **Health Verification**: Monitor `GET /api/health`.
