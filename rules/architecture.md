---
description: Apply when creating or refactoring files in apps/ or packages/
globs: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"]
alwaysApply: true
---

# Architecture Rules — Feature-Sliced Design

## Layer Responsibilities

### `app/` layer — routing only

- Contains ONLY: page.tsx, layout.tsx, loading.tsx, error.tsx, route.ts
- Zero business logic
- Server Components fetch via `serverCaller` from lib/trpc/server.ts
- Pass data as props to Feature/Widget components

Pattern:

```tsx
// ✅ Correct
const data = await serverCaller.partners.list({ ... })
return <PartnerGrid initialData={data} />

// ❌ Wrong — business logic in page
const filtered = data.items.filter(p => p.discountValue > 20)
```

### `features/` layer — business modules

- One folder per business capability: `catalog/`, `membership/`,
  `favorites/`, `referrals/`, `chat/`, `events/`, `promotions/`,
  `onboarding/`, `push/`, `auth/`
- Each feature has: `ui/`, `model/` (hooks + store), `api/` (query wrappers)
- Features CANNOT import from other features
- Features CAN import from `entities/`, `shared/`, `@kyc/ui`, `@kyc/api`

### `entities/` layer — domain models

- Pure data types + lightweight UI for domain objects
- Examples: `Partner`, `Member`, `Event` entity display components
- No mutations, no API calls — presentational only

### `shared/` layer — reusable cross-cutting

- `shared/ui/` — app-specific wrappers around @kyc/ui primitives
- `shared/lib/` — pure utility functions
- `shared/config/` — app-level constants
- `shared/api/` — tRPC client instance + query key helpers

### `widgets/` layer — page compositions

- Assemble features + entities into larger sections
- Examples: `MemberDashboardWidget`, `PartnerSearchWidget`
- Used by `app/` layer; never import from `app/`

## Import Direction (Strictly Enforced)

```
app → widgets → features → entities → shared → @kyc/*
```

Any import going UPWARD is forbidden:

```tsx
// ❌ entities importing from features
import { useFavorites } from "@/features/favorites";
// in packages/entities/partner/PartnerCard.tsx

// ✅ correct — entities stay pure
import { PartnerStatus } from "@kyc/api/schemas";
```

## Server vs Client Component Decision Tree

1. Does it need onClick/onChange/useState/useEffect? → `"use client"`
2. Does it use browser APIs (window, navigator, localStorage)? → `"use client"`
3. Is it a form with real-time validation? → `"use client"`
4. Everything else → Server Component (default, no directive needed)
5. Large third-party libs (Leaflet, recharts, QR canvas): dynamic import
   with `ssr: false` wrapped in a `"use client"` island

## Data Flow Pattern

```
Server Component (page.tsx)
  ↓ serverCaller.procedure()  ← one parallel fetch, no waterfalls
  ↓ props
Feature Component (server or client)
  ↓ TanStack Query (client-side updates only)
  ↓ tRPC mutation
  ↓ optimistic update → rollback on error
```

## Route Group Conventions

- `(marketing)` — public, no auth required, SEO-optimized
- `(member)` — auth required (middleware), member role
- `(auth)` — login/register/verify flows, no auth required
- `(admin)` — auth + admin role + 2FA required (admin app)