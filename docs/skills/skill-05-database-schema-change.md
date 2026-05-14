---
title: Skill 05 — Database Schema Change
description: Use when modifying Prisma schema (new model, column, index)
trigger: "schema change", "add column", "new model", "migration", "prisma"
---

# Skill 05 — Database Schema Change

## When to Use

Any modification to `packages/db/prisma/schema.prisma`.

## Steps

### 1. Edit `schema.prisma`

Apply these requirements to every new model:

```prisma
model NewModel {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  // Foreign keys
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  // Enum for status
  status      NewModelStatus @default(DRAFT)

  // Unique slug if user-facing
  slug        String   @unique

  @@index([ownerId])
  @@index([deletedAt])
  @@index([status])
  @@index([createdAt])
}

enum NewModelStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

Checklist:

- [ ] `id`, `createdAt`, `updatedAt` present
- [ ] `deletedAt DateTime?` for any user-manageable entity
- [ ] FK columns have explicit `@@index`
- [ ] Status fields use enums
- [ ] Many-to-many uses explicit join model (not implicit `[]`)
- [ ] Unique constraints declared explicitly

### 2. Generate the migration

```bash
pnpm --filter @kyc/db prisma migrate dev --name describe_your_change
```

The migration name is `snake_case` and descriptive:

```
✅ add_referral_code_to_member
✅ create_promotion_tables
✅ add_search_vector_to_partner

❌ update
❌ fix_stuff
❌ migration_2
```

### 3. Review the generated SQL

Open `packages/db/prisma/migrations/<timestamp>_<name>/migration.sql`.

Watch out for:

- `DROP TABLE` / `DROP COLUMN` — destructive, requires explicit approval
- `ALTER COLUMN ... TYPE` — may need a data migration first
- Missing indexes Prisma didn't auto-add
- Default values applied to existing rows incorrectly

If destructive: add `[allow-destructive]` to the commit message so the
release workflow allows it.

### 4. Regenerate the Prisma client

```bash
pnpm --filter @kyc/db db:generate
```

Commit the updated `packages/db/generated/client/` if it's tracked
(or skip if it's in .gitignore — check repo convention).

### 5. Update the seed if needed

`packages/db/prisma/seed.ts`:

```ts
// Use upsert for idempotency
await prisma.newModel.upsert({
  where: { slug: "seed-example" },
  update: {},
  create: {
    slug: "seed-example",
    ownerId: adminUser.id,
    status: "PUBLISHED",
  },
});
```

Run:

```bash
pnpm --filter @kyc/db db:seed
```

### 6. Update Zod schemas

In `packages/api/src/schemas/<domain>.schema.ts`, add or modify schemas
matching the new shape. Use Prisma's generated enums:

```ts
import { NewModelStatus } from "@kyc/db";

export const newModelInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  status: z.nativeEnum(NewModelStatus),
});
```

### 7. Update procedures that read/write this model

- Add the new fields to `select` clauses where relevant
- Add `deletedAt: null` filter to public queries
- Update Vitest tests to assert on new fields

### 8. Document in `docs/MIGRATIONS.md`

For non-trivial migrations (data backfills, type changes, renames):
add a short note explaining the rationale and any rollback strategy.

## Forbidden Operations

```bash
# ❌ NEVER edit a committed migration file
vim prisma/migrations/20250101_baseline/migration.sql

# ❌ NEVER reset production DB
prisma migrate reset --force  # only --skip-seed dev DBs

# ❌ NEVER bypass migrations with db:push in prod
prisma db push
```

## Production Deployment

The `release.yml` GitHub Action runs `prisma migrate deploy` against the
production DB BEFORE Vercel publishes the new builds. Never run migrations
manually against prod.

## Acceptance Criteria

- [ ] Schema includes id/createdAt/updatedAt/deletedAt where applicable
- [ ] All FK columns indexed
- [ ] Migration name is descriptive snake_case
- [ ] Migration SQL reviewed for destructive ops
- [ ] Prisma client regenerated
- [ ] Seed updated if new required data
- [ ] Zod schemas updated to match
- [ ] Vitest passes
- [ ] No edits to previously-committed migration files

## Related Skills

- Skill 01 (full feature module — schema is step 2)
- Skill 02 (procedures touching the new fields)