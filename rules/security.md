---
description: Apply when writing tRPC procedures, auth flows, env vars, or any data mutation
globs:
  [
    "packages/api/**/*.ts",
    "apps/*/src/server/**/*.ts",
    "apps/*/src/middleware.ts",
  ]
alwaysApply: true
---

# Security Rules

## tRPC Procedure Checklist

Every new procedure MUST satisfy ALL items:

- [ ] Correct procedure type:
  - public info reads → `publicProcedure`
  - public writes (forms) → `publicLimitedProcedure(limiter)` + rate limit
  - authenticated reads/writes → `memberProcedure`
  - admin mutations → `auditedAdminProcedure({ action, entity })`
  - super-admin-only → `superAdminProcedure`
- [ ] Input validated with Zod schema (no raw `input: z.any()`)
- [ ] Output shape defined — never return raw Prisma objects; select only the
      fields you need
- [ ] Ownership check: member procedures must verify
      `resource.memberId === ctx.session.member.id`
- [ ] Soft-delete awareness: all queries include `deletedAt: null` filter
      unless intentionally reviewing deleted rows
- [ ] Error messages never leak entity existence to unauthorized callers
      (use NOT_FOUND for both "doesn't exist" and "not yours")

## Authentication Guards

```ts
// ✅ Correct — middleware handles /member routes
// In tRPC procedures, still verify contextually:
if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
if (ctx.session.user.role === "MEMBER" && procedureRequiresAdmin) {
  throw new TRPCError({ code: "FORBIDDEN" });
}

// ❌ Never trust role from client input
// input: z.object({ role: z.string() }) — attacker can set role: 'ADMIN'
```

## Input Sanitization Rules

- Strings rendered as HTML → strip via DOMPurify (server: use isomorphic-dompurify)
- Rich text (TipTap output) → always sanitize on read with allowlist
- File uploads → validate MIME type server-side, not just extension
- URLs in input → validate with `z.string().url()` + whitelist known domains
  for partner website/social fields
- Phone numbers → normalize to E.164 before storing
- Email → `z.string().email().toLowerCase().trim()`

## Secrets in Code — Forbidden Patterns

```ts
// ❌ NEVER
const secret = "hardcoded-secret-abc123";
process.env.NEXTAUTH_SECRET = "something";
console.log(process.env.NEXTAUTH_SECRET);

// ✅ Always use env.ts validated env object
import { env } from "@/lib/env";
const secret = env.NEXTAUTH_SECRET;
```

## Data Returned to Client — Sanitize Before Sending

Fields NEVER returned from tRPC procedures:

- `User.hashedPassword`
- `User.twoFactorSecret`
- `PushSubscription.auth` / `.p256dh`
- `Referral.code` (only return the code to the owner)
- `AuditLog.beforeJson` / `.afterJson` for non-admin callers
- `MembershipApplication.notes` for non-admin callers

Pattern:

```ts
// ✅ Use explicit select, not findMany + spread
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    // hashedPassword intentionally omitted
  },
});
```

## CSRF / Request Forgery

- Mutations MUST go through tRPC (`POST /api/trpc/...`) — Auth.js
  CSRF token protects all POST
- Route Handlers that accept non-tRPC mutations must verify
  `Origin` header matches `NEXT_PUBLIC_SITE_URL`
- Cron routes: verify `Authorization: Bearer ${CRON_SECRET}` header

## Rate Limiting Application Map

| Procedure                  | Limiter                   |
| -------------------------- | ------------------------- |
| applications.create        | applicationsLimiter (5/h) |
| auth.register              | authLimiter (10/10m)      |
| auth.requestMagicLink      | authLimiter               |
| auth.changePassword        | authLimiter               |
| chat.sendMessage           | chatLimiter (30/min)      |
| reviews.create             | reviewLimiter (5/h)       |
| all other public mutations | genericPublicLimiter      |

## Audit Log Requirements

Admin mutations that MUST be audit-logged:

- All Partner CRUD (create/update/publish/unpublish/softDelete/purge)
- All Member status changes (suspend/activate/delete)
- All Application status changes (approve/reject)
- All Review moderation (approve/reject)
- All Admin user management
- Auth events (signIn, 2FA verify, password change)
- Push campaign sends
- Deal status changes