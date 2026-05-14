---
title: Skill 02 — Add a New tRPC Procedure
description: Use when adding a single procedure to an existing router
trigger: "add procedure", "new endpoint", "tRPC query", "tRPC mutation"
---

# Skill 02 — Add a New tRPC Procedure

## When to Use

You need a single new query/mutation on an existing router.
For a brand-new domain → use Skill 01 instead.

## Steps

### 1. Define the Zod schema

In `packages/api/src/schemas/<domain>.schema.ts`:

```ts
import { z } from "zod";

export const newProcedureInput = z.object({
  id: z.string().cuid(),
  value: z.string().min(1).max(500),
});
export type NewProcedureInput = z.infer<typeof newProcedureInput>;

// If procedure returns a non-trivial shape, define output schema too:
export const newProcedureOutput = z.object({
  id: z.string(),
  value: z.string(),
  updatedAt: z.date(),
});
export type NewProcedureOutput = z.infer<typeof newProcedureOutput>;
```

### 2. Pick the correct base procedure

| Procedure type           | Use case                                  |
| ------------------------ | ----------------------------------------- |
| `publicProcedure`        | Read-only public data (categories, geo)   |
| `publicLimitedProcedure` | Public writes (apply form, register)      |
| `memberProcedure`        | Authenticated member reads/writes         |
| `adminProcedure`         | Admin operations                          |
| `auditedAdminProcedure`  | Admin mutations that must be audit-logged |
| `superAdminProcedure`    | Destructive operations (purge, regen IDs) |

### 3. Implement with strict ownership + sanitization

```ts
import { TRPCError } from "@trpc/server";
import { router, memberProcedure } from "../trpc";
import { newProcedureInput } from "../schemas/feature.schema";

export const featureRouter = router({
  // ...existing,

  newProcedure: memberProcedure
    .input(newProcedureInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Ownership check (don't leak existence)
      const resource = await ctx.prisma.resource.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
        },
        select: { memberId: true },
      });

      if (!resource) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (resource.memberId !== ctx.session.member.id) {
        // Same code as "not found" — never leak that the resource exists
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // 2. Mutation with explicit select
      const result = await ctx.prisma.resource.update({
        where: { id: input.id },
        data: { value: input.value },
        select: {
          id: true,
          value: true,
          updatedAt: true,
        },
      });

      // 3. Side effects — fire and forget
      sendNotification(ctx.session.user.id, "value_updated").catch(
        console.error,
      );

      return result;
    }),
});
```

### 4. Rate limit if public mutation

```ts
import { applicationsLimiter } from "../lib/ratelimit";

submitForm: publicLimitedProcedure(applicationsLimiter)
  .input(formInput)
  .mutation(async ({ ctx, input }) => { /* ... */ })
```

### 5. Audit log if admin mutation

```ts
updatePartner: auditedAdminProcedure({
  action: 'partner.update',
  entity: 'Partner',
  selectEntityId: (input) => input.id,
})
  .input(partnerUpdateInput)
  .mutation(async ({ ctx, input }) => { /* ... */ })
```

### 6. Cache invalidation if public data changes

```ts
import { revalidateTag } from "next/cache";

// At the end of an admin mutation:
revalidateTag("partners:list");
revalidateTag(`partners:slug:${partner.slug}`);
```

### 7. Add Vitest coverage

In `packages/api/src/__tests__/<domain>.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createMockContext, createCaller } from "./helpers";

describe("feature.newProcedure", () => {
  it("updates value when caller owns the resource", async () => {
    const ctx = createMockContext({ session: memberSession });
    const caller = createCaller(ctx);
    const result = await caller.feature.newProcedure({
      id: myResourceId,
      value: "new",
    });
    expect(result.value).toBe("new");
  });

  it("throws UNAUTHORIZED when called anonymously", async () => {
    const ctx = createMockContext({ session: null });
    const caller = createCaller(ctx);
    await expect(
      caller.feature.newProcedure({ id: myResourceId, value: "x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws NOT_FOUND when resource belongs to another member", async () => {
    const ctx = createMockContext({ session: otherMemberSession });
    const caller = createCaller(ctx);
    await expect(
      caller.feature.newProcedure({ id: myResourceId, value: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when validation fails", async () => {
    const ctx = createMockContext({ session: memberSession });
    const caller = createCaller(ctx);
    await expect(
      caller.feature.newProcedure({ id: myResourceId, value: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

### 8. Consume from UI

Server Component:

```tsx
import { serverCaller } from "@/lib/trpc/server";

const data = await serverCaller.feature.list({ limit: 20 });
```

Client Component (read):

```tsx
"use client";
import { trpc } from "@/shared/api/trpc-client";

const { data, isLoading } = trpc.feature.list.useQuery({ limit: 20 });
```

Client Component (mutate):

```tsx
const utils = trpc.useUtils();
const { mutate, isPending } = trpc.feature.newProcedure.useMutation({
  onSuccess: () => utils.feature.list.invalidate(),
  onError: (err) => toast.error(t(err.message)),
});
```

## Acceptance Criteria

- [ ] Zod schema defined and exported
- [ ] Correct procedure type chosen
- [ ] Ownership check uses NOT_FOUND for both "missing" and "not yours"
- [ ] `select` is explicit — no full Prisma object returned
- [ ] Vitest covers happy + UNAUTHORIZED + FORBIDDEN + NOT_FOUND + BAD_REQUEST
- [ ] Side effects wrapped in try/catch
- [ ] Audit log for admin mutations
- [ ] Cache invalidated if public data changed

## Related Skills

- Skill 01 (full feature module)
- Skill 06 (optimistic UI on this mutation)