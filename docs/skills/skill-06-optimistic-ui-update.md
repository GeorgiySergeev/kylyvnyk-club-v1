---
title: Skill 06 — Optimistic UI Update
description: Use when a mutation must feel instant (favorites, likes, toggles)
trigger: "optimistic", "instant toggle", "feel snappy", "no loading flash"
---

# Skill 06 — Optimistic UI Update

## When to Use

A user action must feel instantaneous AND the operation almost always succeeds:

- Toggle favorite
- Mark read / unread
- Like / unlike
- Star a review
- Drag-to-reorder

DO NOT use optimistic updates for:

- Money / payments
- Account deletion
- Destructive admin actions
- Anything where failure leaves the user confused

## Pattern

```ts
"use client";

import { trpc } from "@/shared/api/trpc-client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function useToggleFavorite() {
  const utils = trpc.useUtils();
  const t = useTranslations("errors");

  return trpc.favorites.toggle.useMutation({
    /**
     * 1. CANCEL in-flight queries to prevent them from overwriting
     *    our optimistic update once they resolve.
     */
    onMutate: async ({ partnerId }) => {
      await utils.favorites.list.cancel();
      await utils.partners.bySlug.cancel();

      /**
       * 2. SNAPSHOT current cache so we can roll back on error.
       */
      const prevFavorites = utils.favorites.list.getData();
      const prevPartner = utils.partners.bySlug.getData({ slug: currentSlug });

      /**
       * 3. OPTIMISTICALLY UPDATE every cache where this partner appears.
       */
      utils.favorites.list.setData(undefined, (old) => {
        if (!old) return old;
        const isAlreadyFav = old.items.some((p) => p.id === partnerId);
        return {
          ...old,
          items: isAlreadyFav
            ? old.items.filter((p) => p.id !== partnerId)
            : [optimisticPartner, ...old.items],
        };
      });

      utils.partners.bySlug.setData({ slug: currentSlug }, (old) =>
        old ? { ...old, isFavorited: !old.isFavorited } : old,
      );

      // Also touch infinite catalog cache:
      utils.partners.list.setInfiniteData({}, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((p) =>
              p.id === partnerId ? { ...p, isFavorited: !p.isFavorited } : p,
            ),
          })),
        };
      });

      /**
       * 4. RETURN context for rollback in onError.
       */
      return { prevFavorites, prevPartner };
    },

    /**
     * 5. ROLLBACK on error using the snapshot from onMutate.
     */
    onError: (err, _vars, ctx) => {
      if (ctx?.prevFavorites) {
        utils.favorites.list.setData(undefined, ctx.prevFavorites);
      }
      if (ctx?.prevPartner) {
        utils.partners.bySlug.setData({ slug: currentSlug }, ctx.prevPartner);
      }
      toast.error(t("favoriteToggleFailed"));
    },

    /**
     * 6. INVALIDATE after settle to converge with server truth.
     *    Even on success we revalidate to pick up any server-side changes
     *    (e.g., onboarding step completion side-effect).
     */
    onSettled: () => {
      utils.favorites.list.invalidate();
      utils.partners.bySlug.invalidate({ slug: currentSlug });
    },
  });
}
```

## Common Pitfalls

### Forgetting to cancel queries

```ts
// ❌ Without cancel, a slow in-flight refetch can overwrite our update
onMutate: () => {
  utils.favorites.list.setData(/* ... */);
};

// ✅ Always cancel first
onMutate: async () => {
  await utils.favorites.list.cancel();
  utils.favorites.list.setData(/* ... */);
};
```

### Not updating all relevant caches

If a partner appears in 3 places (catalog list, favorites list, partner
detail), all 3 must be updated optimistically — otherwise the user sees
inconsistent state.

```ts
// ✅ Touch every cache key that contains this entity
utils.partners.list.setInfiniteData(/* ... */);
utils.favorites.list.setData(/* ... */);
utils.partners.bySlug.setData(/* ... */);
```

### Missing rollback context

```ts
// ❌ Snapshot only one cache → rollback only restores one
onMutate: async () => {
  const prev = utils.favorites.list.getData();
  return { prev };
};
onError: (e, v, ctx) => {
  utils.favorites.list.setData(undefined, ctx?.prev);
  // partner.bySlug never rolled back — UI now inconsistent
};
```

### Debouncing rapid clicks

For toggle buttons that users might click rapidly, debounce or disable
during pending:

```tsx
<Button
  disabled={mutation.isPending}
  onClick={() => mutation.mutate({ partnerId })}
>
```

## Server-Side Onboarding Side Effects

If the optimistic mutation triggers a side-effect (e.g., first favorite
completes onboarding step), do NOT optimistically update the onboarding
state — let `onSettled` invalidation fetch it fresh:

```ts
onSettled: () => {
  utils.favorites.list.invalidate();
  utils.onboarding.listProgress.invalidate(); // server is source of truth
};
```

## Acceptance Criteria

- [ ] `onMutate` cancels in-flight queries
- [ ] All relevant caches updated optimistically
- [ ] Snapshot captured for rollback
- [ ] `onError` restores every snapshotted cache
- [ ] `onSettled` invalidates to converge with server
- [ ] Button disabled or debounced during `isPending`
- [ ] Toast appears on error with localized message

## Related Skills

- Skill 02 (mutation procedure you're optimistically updating)