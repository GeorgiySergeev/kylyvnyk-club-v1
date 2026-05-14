---
title: Common Mistakes Reference
description: Lookup table of anti-patterns to check before/after writing code
trigger: "before commit", "code review", "self check"
---

# Common Mistakes Reference

> Run through this table after writing code. Fix anything that matches.

## Critical Anti-Patterns

| Mistake                                 | Correct Approach                                                          |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Direct `prisma` calls in `apps/`        | Use tRPC procedures via `serverCaller` or `trpc.<router>.<proc>.useQuery` |
| Hardcoded user-facing strings           | `t('namespace.key')` from `useTranslations` / `getTranslations`           |
| New color values not in palette         | Use existing `gold-*` / `ink-*` palette tokens from `@kyc/config`         |
| `console.log` in committed code         | Delete; use `console.error` only inside async `.catch()` blocks           |
| `any` type or `as unknown as X`         | Define proper Zod schema and use `z.infer<typeof Schema>`                 |
| Missing skeleton / loading state        | Wrap with `<Suspense fallback={<Skeleton />}>` or check `isPending`       |
| Missing empty state                     | `if (items.length === 0) return <EmptyState />`                           |
| Blocking on email / push delivery       | `sendEmail(...).catch(console.error)` — fire and forget                   |
| Waterfall server fetches                | `Promise.all([...])` for parallel server-side calls                       |
| Offset pagination                       | Cursor pagination via `take: limit + 1` + slice                           |
| No rollback on optimistic update        | Always provide `onError` with cache restoration                           |
| Admin destructive op without role check | Use `superAdminProcedure` for purge/regen                                 |
| Missing audit log on admin mutation     | Use `auditedAdminProcedure({ action, entity })`                           |
| CSS class doesn't exist in preset       | Verify against `packages/config/tailwind-preset.ts` palette               |
| New env var not validated               | Add to `lib/env.ts` Zod schema + `.env.example` + `docs/ENV.md`           |

## TypeScript Anti-Patterns

| Mistake                           | Correct                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `as any` casts                    | Refactor types or use `satisfies`                               |
| Manually duplicated types         | `type T = z.infer<typeof schema>`                               |
| Unchecked array access            | `noUncheckedIndexedAccess` is on — check `arr[i]` for undefined |
| Type assertions on user input     | Validate with Zod first, then types are guaranteed              |
| `@ts-ignore` / `@ts-expect-error` | Fix the underlying type issue; don't suppress                   |

## Database Anti-Patterns

| Mistake                              | Correct                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| Forgot `deletedAt: null` filter      | Always filter soft-deleted in public/member queries           |
| `include` everything                 | Use explicit `select` — never spread Prisma objects to client |
| Hard delete on user data             | Soft delete (set `deletedAt`); purge only via SUPER_ADMIN     |
| String concat in raw SQL             | Tagged templates only: `prisma.$queryRaw'...${param}...'`     |
| Edit a committed migration           | Never. Create a new migration that fixes the previous.        |
| No transaction for multi-step writes | Wrap in `prisma.$transaction(async (tx) => { ... })`          |
| Missing index on FK column           | Add `@@index([fkColumn])` to schema                           |

## API Anti-Patterns

| Mistake                                       | Correct                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `throw new Error('not found')`                | `throw new TRPCError({ code: 'NOT_FOUND' })`         |
| Leaking entity existence to unauthorized      | Use NOT_FOUND for both "missing" and "not yours"     |
| Returning sensitive fields (password, secret) | Use explicit `select` excluding sensitive fields     |
| Skipping rate limit on public write           | Wrap with `publicLimitedProcedure(limiter)`          |
| Missing ownership check                       | Verify `resource.memberId === ctx.session.member.id` |
| Mutating in `.query()`                        | Queries are read-only — use `.mutation()` for writes |
| No Zod input validation                       | Every procedure has `.input(zodSchema)`              |

## React / Next.js Anti-Patterns

| Mistake                                       | Correct                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `"use client"` on a page that doesn't need it | Default to Server Component; client only when needed                |
| Calling hooks in Server Components            | Hooks only in `"use client"` components                             |
| Direct DOM manipulation                       | Use refs + effects, or controlled state                             |
| `useEffect` for data fetching                 | Use TanStack Query (`useQuery`) or Server Component fetch           |
| Missing key on list items                     | `key={item.id}` — never `key={index}` unless static                 |
| Setting state during render                   | Move to `useEffect` or event handler                                |
| `next/link` to external URL                   | Use `<a href target="_blank" rel="noopener noreferrer">`            |
| `<img>` without dimensions                    | `<Image width height />` or `<Image fill className="object-cover">` |
| `priority` on every image                     | Only on the first above-the-fold image                              |

## UI / a11y Anti-Patterns

| Mistake                            | Correct                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `<div onClick>` instead of button  | Use `<button>` or `<a>` for interactive elements       |
| Icon button without aria-label     | Add `aria-label="..."` or `<span className="sr-only">` |
| `alt="image"` or `alt="logo"`      | Descriptive alt or `alt=""` for purely decorative      |
| Inline `style={{ color: '#...' }}` | Use Tailwind palette classes                           |
| Hardcoded breakpoints              | Use Tailwind's `sm:` `md:` `lg:` `xl:` prefixes        |
| Touch targets under 44×44px        | `min-h-[44px] min-w-[44px]` for interactive elements   |
| No focus ring                      | `focus-visible:ring-2 focus-visible:ring-gold-500`     |
| Modal without focus trap           | Use Radix Dialog (built-in trap) or implement manually |

## i18n Anti-Patterns

| Mistake                                 | Correct                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| String literal in JSX                   | `t('key')` always                                                 |
| Splitting plurals by suffix             | ICU plural syntax: `{count, plural, one {...} other {...}}`       |
| Adding key to only RU                   | Add to RU + EN + UK — CI fails on mismatch                        |
| Using nested keys > 3 levels deep       | Flatten or refactor into a new namespace                          |
| Hardcoded `new Date().toLocaleString()` | Use `@kyc/i18n` formatters                                        |
| `window.location.href = '/en/...'`      | Use next-intl `useRouter` to preserve path while switching locale |

## Security Anti-Patterns

| Mistake                                 | Correct                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| Secret in `NEXT_PUBLIC_*` env var       | Server-only env vars never prefixed with `NEXT_PUBLIC_`      |
| Trusting `role` from client input       | Read role from `ctx.session.user.role`                       |
| Storing TOTP secret in plain text       | Encrypt via `lib/crypto.ts` with `ADMIN_TOTP_ENCRYPTION_KEY` |
| No CSRF check on non-tRPC POST          | Verify `Origin` header matches `NEXT_PUBLIC_SITE_URL`        |
| Logging passwords / secrets to Sentry   | `sanitizeForAudit` payloads before sending to Sentry         |
| Allowing arbitrary HTML in user content | Sanitize with isomorphic-dompurify before render             |
| Cron route without `CRON_SECRET` check  | `Authorization: Bearer ${env.CRON_SECRET}` required          |

## Performance Anti-Patterns

| Mistake                                    | Correct                                                             |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Sequential `await`s for independent ops    | `await Promise.all([...])`                                          |
| Importing entire icon library              | Named imports: `import { Heart } from 'lucide-react'`               |
| Loading Leaflet/recharts at top level      | Dynamic import with `ssr: false`                                    |
| No caching for static-ish data             | Wrap with `unstable_cache` + `revalidateTag`                        |
| Polling at < 8s intervals                  | Use TanStack Query intervals ≥ 8s; or Supabase Realtime for instant |
| Long lists rendered without virtualization | Use `@tanstack/react-virtual` for lists > 50 items                  |

## Testing Anti-Patterns

| Mistake                             | Correct                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `test.only` committed               | Remove before commit — CI blocks merge                     |
| `test.skip` without reason          | Add `// reason: tracked in #123` comment                   |
| `page.waitForTimeout(2000)`         | `await expect(locator).toBeVisible()`                      |
| Locator on CSS class                | `page.getByTestId(id)` or `page.getByRole(role, { name })` |
| Snapshotting entire page            | Snapshot small stable components only                      |
| Hitting real Resend / push in tests | Mock with `vi.mock` or env flag `RESEND_API_KEY=mock-`     |
| Test against production-like data   | Always reset via `resetDb()` between tests                 |
