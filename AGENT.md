# AGENT.md — Kylyvnyk Club AI Coding Agent Guide

> This file is read by Cursor, GitHub Copilot, and any AI coding agent working
> in this repository. Follow every rule here without exception. If a rule
> conflicts with a user request, surface the conflict and ask for clarification
> before proceeding.

---

## 1. Project Identity

| Property        | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Product         | Kylyvnyk Club — International Business Club            |
| Monorepo        | Turborepo + pnpm workspaces                            |
| Apps            | apps/web (member portal) · apps/admin (CMS)            |
| Packages        | @kyc/ui · @kyc/api · @kyc/db · @kyc/i18n · @kyc/config |
| Primary locales | Russian (ru) · English (en) · Ukrainian (uk)           |
| Node version    | 20 (see .nvmrc)                                        |
| Package manager | pnpm@9 — never use npm or yarn                         |

---

## 2. Non-Negotiable Constraints

### 2.1 TypeScript

- `strict: true` everywhere. No `any`, no `@ts-ignore`, no `as unknown as X`.
- Use `satisfies` operator instead of casting where possible.
- Prefer `z.infer<typeof Schema>` over manually duplicated types.
- `noUncheckedIndexedAccess` is ON — always check array access results.

### 2.2 Architecture — Feature-Sliced Design (FSD)

```
src/
├─ app/          # Next.js routes ONLY — no business logic
├─ features/     # Self-contained feature modules
├─ entities/     # Domain models (read-only shared state)
├─ shared/       # Pure utilities, UI primitives, configs
└─ widgets/      # Assembled compositions of features + entities
```

- New business logic → `src/features/<feature-name>/`
- Shared UI primitives → `packages/ui` (never in apps directly)
- No cross-feature imports in the same direction (features cannot
  import from other features; they import from entities + shared only)
- No business logic in `app/` layer — routes compose features

### 2.3 API Rules

- ALL data fetching goes through tRPC procedures in `@kyc/api`
- Server Components use the server-side tRPC caller (`lib/trpc/server.ts`)
- Client Components use `trpc.<router>.<procedure>.useQuery/useMutation`
- NEVER call `prisma` directly from `apps/web` or `apps/admin` source files
  — only through tRPC procedures
- NEVER put tRPC procedures inside `app/` Route Handlers directly —
  implement in `@kyc/api` and call from handlers

### 2.4 Strings — i18n Mandatory

- ZERO hardcoded user-facing strings in components or pages
- Always use `useTranslations('namespace')` (client) or
  `getTranslations('namespace')` (server)
- Message keys live in `packages/i18n/messages/{locale}/{namespace}.json`
- Add new keys to ALL THREE locales simultaneously — CI will fail otherwise
- Namespace mapping: marketing · member · catalog · auth · applications ·
  referrals · events · promotions · chat · notifications · onboarding ·
  legal · admin · common · errors

### 2.5 Security — Zero Compromise

- Never expose secrets in Client Components or browser-reachable code
- Never put `NEXTAUTH_SECRET`, `ADMIN_TOTP_ENCRYPTION_KEY`,
  `SUPABASE_JWT_SECRET`, or `MEMBERSHIP_CARD_SECRET` in `NEXT_PUBLIC_*`
- Every admin mutation must go through `auditedAdminProcedure` from @kyc/api
- Rate-limit every public mutation using the appropriate limiter from @kyc/api
- Sanitize all user-generated content before storing; sanitize audit payloads
  via `sanitizeForAudit()` before writing AuditLog
- Never skip RLS on Supabase Realtime channels
- bcryptjs cost factor = 12 everywhere, never lower

### 2.6 Database

- Prisma is the ONLY ORM. Raw SQL only via `prisma.$queryRaw` with
  tagged-template literals (never string concatenation)
- Every delete = soft delete (set `deletedAt`). Hard delete = `purge`
  procedure (SUPER_ADMIN only)
- Every migration must be reviewed for destructive statements before commit
- `db:push` in dev only; `db:deploy` in CI/production
- Never modify a migration file after it has been committed and deployed

### 2.7 Styling

- Tailwind v4 utility classes only — no inline `style={{}}` except
  for truly dynamic values (e.g., percentage widths from JS)
- No new colors outside the `@kyc/config` palette
  (gold-50…900, ink-50…950, semantic CSS vars)
- All custom components in `packages/ui` must use CVA for variants
- Never hardcode hex/rgb values anywhere in source code

### 2.8 Testing

- New procedure → Vitest unit tests in same package under `__tests__/`
- New E2E flow → Playwright spec in `e2e/web/` or `e2e/admin/`
- No `test.only` committed (CI will fail)
- No `test.skip` without a `// reason: ` comment
- Mocks for Resend, web-push, UploadThing — never hit real services in tests
- `data-testid` on every interactive element a Playwright spec references

### 2.9 Error Handling

- tRPC errors: use `TRPCError` with typed `code` — never `throw new Error()`
  inside a procedure
- Client mutations: every `onError` must surface a toast with a
  localized message from `errors.json`
- Non-critical async side-effects (email, push, audit): wrap in
  `try/catch` + `console.error` — never let them crash the parent request
- Sentry: handled errors (validation, auth failures) should NOT be reported;
  unexpected 5xx-level errors should be captured via `reportError()`

---

## 3. File Naming Conventions

| Type            | Convention          | Example                      |
| --------------- | ------------------- | ---------------------------- |
| React Component | PascalCase.tsx      | PartnerCard.tsx              |
| Page (Next.js)  | page.tsx (fixed)    | page.tsx                     |
| Route Handler   | route.ts (fixed)    | route.ts                     |
| Hook            | use + camelCase.ts  | useToggleFavoriteMutation.ts |
| Utility / lib   | camelCase.ts        | slugify.ts                   |
| Server action   | camelCase.action.ts | approveApplication.action.ts |
| tRPC Router     | camelCase.ts        | partners.ts                  |
| Zod schema      | camelCase.schema.ts | partner.schema.ts            |
| Vitest test     | \*.test.ts(x)       | partners.test.ts             |
| Playwright spec | \*.spec.ts          | catalog.spec.ts              |
| Storybook story | \*.stories.tsx      | PartnerCard.stories.tsx      |
| Type-only file  | \*.types.ts         | member.types.ts              |
| Constants       | SCREAMING_SNAKE.ts  | ALLOWED_CATEGORY_ICONS.ts    |

---

## 4. Commit Message Convention

Format: `<type>(<scope>): <imperative short summary>`

Types: feat · fix · refactor · style · test · docs · chore · perf · ci

Scopes: web · admin · api · db · ui · i18n · config · e2e · infra

Examples:

```
feat(web): implement partner detail page with Leaflet map
fix(api): prevent self-referral in referrals.create procedure
test(e2e): add Playwright spec for application approval flow
chore(db): baseline Prisma migration
```

Rules:

- Max 72 chars in subject line
- Body explains WHY (not what — code shows what)
- Footer: `Closes #123` if applicable
- Never `[skip ci]` on merges to main

---

## 5. PR Rules

Before opening a PR:

1. `pnpm turbo run lint typecheck` — zero errors
2. `pnpm test` — all Vitest suites green
3. If schema changed: `pnpm --filter @kyc/db db:generate` committed
4. If new messages added: all 3 locales updated + parity test passes
5. `pnpm --filter @kyc/web build && pnpm --filter @kyc/admin build` —
   no type errors in the Next.js build phase
6. If new env var: added to `.env.example` + `docs/ENV.md`

---

## 6. What AI Agents Must NOT Do

- Do NOT install packages without explicit user approval
- Do NOT modify `prisma/migrations/` files that already exist
- Do NOT change `packages/config/tailwind-preset.ts` palette
  without explicit user instruction
- Do NOT refactor across more than one FSD layer in a single prompt
- Do NOT add `// eslint-disable` or biome-ignore comments
  without a clear explanation
- Do NOT create duplicate components — check @kyc/ui first
- Do NOT generate placeholder `// TODO` functions and mark the
  block "done" — either implement or clearly state scope limitation
- Do NOT skip error handling or loading/skeleton states in UI
- Do NOT put business logic in layout.tsx files
- Do NOT bypass the tRPC layer (no direct prisma calls in app sources)
- Do NOT introduce a new state management library
  (Zustand + TanStack Query are the approved pair)
- Do NOT add console.log statements to committed code
  (console.error for caught async errors only)

---

## 7. Approved Package List

When a new dependency is needed, check this list first. If the requirement is
met by an existing package, use it. If not listed, propose adding it in your
response before installing.

### Core framework

next@15 · react@19 · react-dom@19 · typescript@5

### Styling

tailwindcss@4 · tailwind-merge · clsx · class-variance-authority

### UI primitives

@radix-ui/\* · lucide-react · framer-motion · sonner · vaul · cmdk
react-day-picker · @dnd-kit/core · @dnd-kit/sortable

### Data / state

@tanstack/react-query@5 · @tanstack/react-table@8 · @tanstack/react-virtual
zustand · zod · superjson

### Forms

react-hook-form · @hookform/resolvers

### API / server

@trpc/server@11 · @trpc/client@11 · @trpc/react-query@11
@prisma/client · prisma · next-auth@5 · @auth/prisma-adapter

### i18n

next-intl

### Auth extras

bcryptjs · otplib

### Email

resend · @react-email/components

### File upload

uploadthing · @uploadthing/react

### Push

web-push

### Realtime

@supabase/supabase-js

### Maps

leaflet · react-leaflet · @types/leaflet

### Charts

recharts

### Rich text

@tiptap/react · @tiptap/starter-kit

### PWA

serwist · @serwist/next

### Observability

@sentry/nextjs · posthog-js · posthog-node

### Rate limiting / caching

@upstash/redis · @upstash/ratelimit

### QR codes

qrcode · @types/qrcode

### Utilities

nanoid · transliteration · @faker-js/faker · tsx · js-cookie

### Testing

vitest · @vitest/coverage-v8 · @testing-library/react
@playwright/test · @storybook/react-vite · @storybook/test-runner
@axe-core/playwright · react-hotkeys-hook

---

## 8. Environment Variable Rules

- Prefix `NEXT_PUBLIC_` ONLY for values the browser must read
- Never prefix secrets with `NEXT_PUBLIC_`
- Every new var must be added to:
  1. `.env.example` (with placeholder + comment)
  2. `apps/web/src/lib/env.ts` or `apps/admin/src/lib/env.ts` (Zod validation)
  3. `docs/ENV.md` (description, required/optional, where used)
- Env var names: SCREAMING_SNAKE_CASE

---

## 9. Performance Budget

| Metric                   | Target (mobile) | Block CI if failed |
| ------------------------ | --------------- | ------------------ |
| Lighthouse Performance   | ≥ 90            | No (advisory)      |
| Lighthouse SEO           | 100             | No (advisory)      |
| Lighthouse A11y          | ≥ 95            | No (advisory)      |
| LCP                      | < 2.5s          | No (advisory)      |
| First tRPC response      | < 200ms (p50)   | No (advisory)      |
| Vitest suite (unit only) | < 30s total     | Yes                |
| Build (apps/web)         | < 120s          | Yes (CI timeout)   |

---

## 10. Quick Reference — Critical File Paths

```
@kyc/api procedures:    packages/api/src/routers/
@kyc/api schemas:       packages/api/src/schemas/
@kyc/db schema:         packages/db/prisma/schema.prisma
@kyc/db seed:           packages/db/prisma/seed.ts
@kyc/ui components:     packages/ui/src/components/
@kyc/ui styles:         packages/ui/styles/globals.css
@kyc/i18n messages:     packages/i18n/messages/{locale}/
Tailwind preset:        packages/config/tailwind-preset.ts
web tRPC context:       apps/web/src/lib/trpc/context.ts
admin tRPC context:     apps/admin/src/lib/trpc/context.ts
Auth config (web):      apps/web/src/server/auth/config.ts
Auth config (admin):    apps/admin/src/server/auth/config.ts
Email templates:        apps/web/src/server/email/templates/
Push helper:            apps/web/src/server/push/webPush.ts
E2E specs:              e2e/
Env docs:               docs/ENV.md
```
