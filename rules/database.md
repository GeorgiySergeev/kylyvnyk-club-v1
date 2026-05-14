---
description: Apply when editing Prisma schema, migrations, or any DB query
globs: ["packages/db/**/*.{ts,prisma}", "packages/api/src/routers/**/*.ts"]
alwaysApply: true
---

# Database Rules

## Schema Change Checklist

Before editing `schema.prisma`:

- [ ] New table needs: `id String @id @default(cuid())`,
      `createdAt DateTime @default(now())`,
      `updatedAt DateTime @updatedAt`
- [ ] Deletable entities need: `deletedAt DateTime?`
- [ ] Status fields use Prisma enums (not plain String)
- [ ] FK columns have `@@index` declarations
- [ ] Unique constraints are explicit (`@@unique` or `@unique`)
- [ ] Every many-to-many uses an explicit join model (not implicit)
- [ ] Run `pnpm --filter @kyc/db db:generate` after schema change

## Query Patterns

### Always Filter Soft-Deleted Rows

```ts
// ✅ Required in every public-facing query
prisma.partner.findMany({
  where: {
    deletedAt: null,
    status: "PUBLISHED",
  },
});

// ❌ Forgot soft-delete filter — leaks deleted data
prisma.partner.findMany({
  where: { status: "PUBLISHED" },
});
```

### Prefer `select` Over `include` for Performance

```ts
// ✅ Select only what the API returns
prisma.partner.findMany({
  select: {
    id: true,
    slug: true,
    nameRu: true,
    city: { select: { nameRu: true } },
  },
});

// ❌ Over-fetches, leaks sensitive fields
prisma.partner.findMany({ include: { city: true } });
```

### Cursor Pagination Pattern

```ts
const items = await prisma.partner.findMany({
  take: limit + 1, // take one extra to detect next page
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0, // skip the cursor item itself
  orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
});
const hasMore = items.length > limit;
const nextCursor = hasMore ? items[limit - 1]?.id : null;
return { items: items.slice(0, limit), nextCursor };
```

### Transactions for Multi-Step Mutations

```ts
// ✅ Wrap related mutations in a transaction
await prisma.$transaction(async (tx) => {
  const member = await tx.member.create({
    /* ... */
  });
  await tx.memberSequence.upsert({
    /* ... */
  });
  await tx.referral.update({
    /* ... */
  });
  return member;
});
// If any step fails → full rollback automatically
```

### Raw SQL Rules

```ts
// ✅ Safe — tagged template literal (Prisma sanitizes params)
prisma.$queryRaw`
  SELECT id, ts_rank(search_vector, query) as rank
  FROM "Partner"
  WHERE search_vector @@ plainto_tsquery('simple', ${searchTerm})
  AND "deletedAt" IS NULL
  ORDER BY rank DESC
`;

// ❌ NEVER string concatenation in raw SQL
prisma.$queryRawUnsafe(`SELECT * FROM "Partner" WHERE slug = '${slug}'`); // SQL injection
```

## Seed Rules

- `prisma/seed.ts` must be idempotent (safe to run multiple times)
- Use `upsert` not `create` for seed data that may already exist
- Seed file is for DEMO data only — no business logic
- Production-sensitive defaults (like admin passwords) must come from env

## Migration Rules

- Never edit an existing migration `.sql` file
- Migration names: `snake_case` descriptive (`add_referral_code_to_member`)
- After schema change in dev: `prisma migrate dev --name <name>`
- Review generated SQL before committing — check for:
  - Unintended `DROP` statements
  - Large table modifications without a strategy (out of MVP — document)
  - Missing indexes on FK columns Prisma didn't auto-add

## Sequence / Counter Pattern (MemberCardId)

```ts
// ✅ Atomic increment in transaction
const seq = await tx.memberSequence.upsert({
  where: { countryCode },
  update: { lastValue: { increment: 1 } },
  create: { countryCode, lastValue: 1 },
  select: { lastValue: true },
});
const cardId = `KYC-${countryCode}-${String(seq.lastValue).padStart(6, "0")}`;
```