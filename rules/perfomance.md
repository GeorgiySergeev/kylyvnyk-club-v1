---
description: Apply when building pages, components, or data-fetching logic
globs: ["apps/**/*.{ts,tsx}", "packages/api/**/*.ts"]
alwaysApply: false
---

# Performance Rules

## Data Fetching — No Waterfalls

### Server Component — Parallel Fetch

```ts
// ✅ Parallel — fastest possible
const [partners, categories, countries] = await Promise.all([
  serverCaller.partners.list({ locale }),
  serverCaller.categories.list(),
  serverCaller.geo.listCountries(),
]);

// ❌ Sequential waterfall — adds latency for each call
const partners = await serverCaller.partners.list({ locale });
const categories = await serverCaller.categories.list();
const countries = await serverCaller.geo.listCountries();
```

### Client Component — Batch Where Possible

- tRPC's `httpBatchLink` batches concurrent queries automatically
- Do NOT make multiple `useQuery` calls that depend on each other in a loop
- Use `useQueries` for a dynamic list of parallel queries

## Caching Strategy

- Server Components: wrap stable queries in `unstable_cache` with `revalidateTag`
- Static content (categories, countries): `revalidate: 3600` (1 hour)
- Partner lists: `revalidate: 300` (5 min) or revalidateTag on admin change
- Partner detail: `revalidate: 300` + revalidateTag per slug on edit
- User-specific data (dashboard, favorites): NO cache — always fresh
- TanStack Query default `staleTime: 60_000` (1 min) for catalog data

## Image Optimization

Every `<Image>` must have:

- `sizes` prop describing breakpoints: `sizes="(max-width: 768px) 100vw, 50vw"`
- `width` + `height` OR `fill` + `className="object-cover"`
- `priority` ONLY on the first image in the viewport (hero)
- Loading = 'lazy' (default — do NOT set explicitly unless overriding)

## Bundle Size

- Import only what you use from icon libraries:

```ts
// ✅
import { Heart, Search, Globe } from "lucide-react";
// ❌
import * as Icons from "lucide-react";
```

- Large optional UI (Leaflet, recharts, QR canvas) → dynamic import:

```ts
const PartnerMap = dynamic(() => import("@/features/catalog/PartnerMap"), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});
```

- Storybook / testing utils must NOT appear in production bundles

## Rendering Patterns

- Default to Server Components. Upgrade to `"use client"` ONLY when needed.
- Large lists (>50 items): virtualize with `@tanstack/react-virtual`
- Infinite scroll trigger: `IntersectionObserver` on the last visible item
- Avoid re-renders: memoize expensive components with `React.memo`
  only after profiling — do not memo by default

## tRPC Query Keys

- Use TanStack Query `queryClient.invalidateQueries({ queryKey })` on mutation
- Use `queryClient.setQueryData` for optimistic updates
- Cancel in-flight queries before optimistic update:

```ts
await queryClient.cancelQueries({ queryKey: ["favorites.list"] });
```

## Suspense Boundaries — Required Placement

```tsx
// ✅ Fine-grained Suspense — stream partial content immediately
export default function CatalogPage() {
  return (
    <div>
      <FilterRail /> {/* renders instantly (client) */}
      <Suspense fallback={<PartnerGridSkeleton />}>
        <PartnerGrid /> {/* streams when ready */}
      </Suspense>
    </div>
  );
}
```