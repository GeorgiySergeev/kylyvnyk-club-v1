---
title: Skill 01 — Add a New Feature Module
description: Use when adding a new business capability (e.g., "Events for Partners", "Loyalty Tiers")
trigger: "create module", "new feature", "add feature", "new section"
---

# Skill 01 — Add a New Feature Module

## When to Use

You need to add a new business capability that spans multiple layers: DB model,
tRPC procedures, message catalog, UI components, pages, admin CRUD.

Examples: "Events for Partners", "Loyalty Tiers", "Wishlist", "Notifications
Center".

## Prerequisites

- AGENT.md read
- Architecture rules understood (FSD layers, no upward imports)

## Steps

### 1. Scope the feature

Answer in your response BEFORE writing code:

- Does it need a new DB model? Which existing models does it relate to?
- Does it need a public route, a member route, or only admin?
- Does it need i18n strings? Which namespace?
- Does it need realtime, push, or email side-effects?

### 2. Database layer (`packages/db`)

```prisma
// packages/db/prisma/schema.prisma
model NewFeature {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  // domain fields here

  @@index([deletedAt])
  @@index([createdAt])
}
```

Run:

```bash
pnpm --filter @kyc/db prisma migrate dev --name add_new_feature
pnpm --filter @kyc/db db:generate
```

If seed data needed, extend `prisma/seed.ts` with idempotent `upsert` calls.

### 3. Schema layer (`packages/api/src/schemas`)

Create `<feature>.schema.ts`:

```ts
import { z } from 'zod'

export const featureListInput = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  filter: z
    .object({
      status: z.enum(['active', 'archived']).optional(),
    })
    .optional(),
})
export type FeatureListInput = z.infer<typeof featureListInput>

export const featureCreateInput = z.object({
  // required + optional fields with strict validation
})
export type FeatureCreateInput = z.infer<typeof featureCreateInput>
```

### 4. Router layer (`packages/api/src/routers`)

Create `<feature>.ts`:

```ts
import { router, publicProcedure, memberProcedure } from '../trpc'
import { featureListInput } from '../schemas/feature.schema'

export const featureRouter = router({
  list: memberProcedure
    .input(featureListInput)
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.newFeature.findMany({
        where: {
          deletedAt: null,
          // additional filters from input
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          // explicit select, never spread
        },
      })

      const hasMore = items.length > input.limit
      return {
        items: items.slice(0, input.limit),
        nextCursor: hasMore ? (items[input.limit - 1]?.id ?? null) : null,
      }
    }),

  // Add other procedures: get, create, update, delete (soft)
})
```

Wire into `packages/api/src/root.ts`:

```ts
import { featureRouter } from './routers/feature'

export const appRouter = router({
  // ...existing routers,
  feature: featureRouter,
})
```

### 5. i18n layer (`packages/i18n`)

Create message files for ALL THREE locales:

```
packages/i18n/messages/ru/feature.json
packages/i18n/messages/en/feature.json
packages/i18n/messages/uk/feature.json
```

Example RU:

```json
{
  "title": "Новый раздел",
  "empty": {
    "title": "Пока ничего нет",
    "description": "Создайте первую запись"
  },
  "actions": {
    "create": "Создать",
    "edit": "Редактировать",
    "delete": "Удалить"
  }
}
```

Run parity check:

```bash
pnpm --filter @kyc/i18n test
```

### 6. UI layer (`apps/web/src/features/<feature>/`)

Folder structure:

```
apps/web/src/features/<feature>/
├─ api/
│  └─ queries.ts          ← TanStack Query wrapper hooks
├─ ui/
│  ├─ FeatureList.tsx     ← Server-Component-safe by default
│  ├─ FeatureCard.tsx
│  └─ FeatureForm.tsx     ← "use client" if interactive
├─ model/
│  └─ useFeatureStore.ts  ← Zustand slice (only if local state needed)
└─ index.ts               ← public surface — explicit exports only
```

Pattern for `api/queries.ts`:

```ts
import { trpc } from '@/shared/api/trpc-client'

export function useFeatureList(filter: FeatureListInput) {
  return trpc.feature.list.useInfiniteQuery(filter, {
    getNextPageParam: (last) => last.nextCursor,
  })
}
```

### 7. Pages (`apps/web/src/app/`)

```
apps/web/src/app/[locale]/(member)/<feature>/
├─ page.tsx               ← Server Component, server-fetches first page
└─ loading.tsx            ← Skeleton fallback
```

```tsx
import { getTranslations } from 'next-intl/server'
import { serverCaller } from '@/lib/trpc/server'
import { FeatureList } from '@/features/feature/ui/FeatureList'

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'feature' })
  return { title: t('title') }
}

export default async function Page({ params: { locale } }) {
  const initialData = await serverCaller.feature.list({ limit: 20 })
  return <FeatureList initialData={initialData} />
}
```

### 8. Admin layer (`apps/admin/src/app/[locale]/(admin)/<feature>/`)

- `page.tsx` — DataTable list view
- `[id]/page.tsx` — create/edit form (id="new" for create)
- Procedures live under `admin.feature.*` in
  `packages/api/src/routers/admin/feature.ts`
- All admin mutations use `auditedAdminProcedure`

Add to `AdminNavItems.ts`:

```ts
{
  key: 'feature',
  icon: 'Sparkles',
  href: '/feature',
  roles: ['ADMIN', 'SUPER_ADMIN'],
  section: 'system',
}
```

### 9. Tests

- `packages/api/src/__tests__/feature.test.ts` — Vitest:
  - Happy path
  - Validation failure
  - Authorization failure (UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  - Pagination consistency
- `e2e/web/feature.spec.ts` — Playwright:
  - User flow end-to-end with `data-testid` selectors

### 10. Storybook

Any new `@kyc/ui` component you introduce: add `*.stories.tsx` with at least the
default state, loading state, and empty state.

## Acceptance Criteria

- [ ] DB migration generated and reviewed
- [ ] All procedures typecheck and have Vitest coverage
- [ ] i18n keys exist in RU/EN/UK and parity test passes
- [ ] Server-Component-first pages with Suspense + skeleton
- [ ] Empty state, loading state, error state all handled
- [ ] Admin CRUD reachable from sidebar
- [ ] Playwright E2E green
- [ ] No `any`, no hardcoded strings, no direct Prisma in apps

## Related Skills

- Skill 02 (tRPC procedure)
- Skill 03 (i18n namespace)
- Skill 04 (admin route)
- Skill 05 (DB schema change)
