---
description: Apply when creating or editing tRPC routers, Zod schemas, or API utilities
globs: ["packages/api/**/*.ts"]
alwaysApply: true
---

# tRPC API Rules

## Procedure Anatomy

Every procedure follows this structure:

```ts
export const partnerRouter = router({
  // 1. Choose the correct base procedure
  list: publicProcedure
    // 2. Define input with Zod schema (from schemas/ file)
    .input(partnerListInput)
    // 3. Implement with explicit return type or inferred output
    .query(async ({ ctx, input }) => {
      // 4. Business logic here (no UI, no React, no imports from apps/)
      // 5. Return shape must match the Zod output schema
      return { items, nextCursor, total };
    }),

  create: auditedAdminProcedure({
    action: "partner.create",
    entity: "Partner",
  })
    .input(partnerCreateInput)
    .mutation(async ({ ctx, input }) => {
      // 6. Side effects after DB write (revalidateTag, email, push)
      // 7. Fire-and-forget wrapped in try/catch for non-critical ops
    }),
});
```

## Input/Output Schema Co-location

```
packages/api/src/schemas/
├─ partners.schema.ts   ← partnerListInput, partnerCreateInput, PartnerListItem
├─ member.schema.ts
└─ ...

packages/api/src/routers/
├─ partners.ts          ← imports from ../schemas/partners.schema
└─ ...
```

Schemas are imported by both the router and the frontend forms (via @kyc/api/schemas).

## Cache Invalidation with next/cache

When an admin mutation changes publicly-displayed data:

```ts
import { revalidateTag } from "next/cache";

// In the mutation, after successful DB write:
revalidateTag("partners:list");
revalidateTag(`partners:slug:${partner.slug}`);
```

And the Server Component that fetches must be tagged:

```ts
const data = await unstable_cache(
  () => serverCaller.partners.list({ ... }),
  ['partners:list'],
  { tags: ['partners:list'], revalidate: 300 }
)()
```

## Error Code Standards

| Situation                         | TRPCError code        |
| --------------------------------- | --------------------- |
| Not logged in                     | UNAUTHORIZED          |
| Logged in but wrong role          | FORBIDDEN             |
| Resource not found (or not yours) | NOT_FOUND             |
| Duplicate / unique constraint     | CONFLICT              |
| Zod validation fail               | BAD_REQUEST           |
| Rate limit exceeded               | TOO_MANY_REQUESTS     |
| External service down             | INTERNAL_SERVER_ERROR |
| Not yet implemented               | NOT_IMPLEMENTED       |

## Procedure Naming Conventions

- Reads: `list`, `get`, `bySlug`, `byId`, `search`, `summary`, `stats`
- Writes: `create`, `update`, `delete`, `restore`, `purge`, `publish`,
  `unpublish`, `approve`, `reject`, `toggle`, `setStatus`, `reorder`,
  `bulkUpdate`

## Context Shape (Do Not Change Without Updating Both Apps)

```ts
type Context = {
  session: Session | null; // Auth.js session
  prisma: PrismaClient; // Singleton from @kyc/db
  ip: string | null; // x-forwarded-for
  userAgent: string | null; // User-Agent header
};
```

## Sub-router Organization

```
appRouter
├─ auth          (register, login, me, updateProfile, 2FA)
├─ member        (getDashboard, getCardData, onboarding)
├─ partners      (list, bySlug, related)
├─ categories    (list)
├─ geo           (listCountries, listCities)
├─ favorites     (list, toggle, isFavorited)
├─ applications  (create)
├─ deals         (list, get, selfReport)
├─ reviews       (create, listByPartner, summaryByPartner)
├─ referrals     (getMyCode, stats, list)
├─ events        (list, bySlug, register, cancelRegistration, myEvents)
├─ promotions    (listActive, byPartner)
├─ chat          (getOrCreateConversation, listMessages, sendMessage, markRead)
├─ push          (subscribe, unsubscribe, updateChannels)
├─ onboarding    (listSteps)
└─ admin         (partners, categories, geo, applications, members,
                  deals, reviews, events, promotions, chat, push,
                  onboarding, audit, users, dashboard)
```