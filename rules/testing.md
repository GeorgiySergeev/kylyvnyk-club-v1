---
description: Apply when writing or editing test files (*.test.ts, *.spec.ts, *.stories.tsx)
globs:
  [
    "**/*.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}",
    "**/*.stories.tsx",
    "e2e/**/*.ts",
  ]
alwaysApply: true
---

# Testing Rules

## Vitest — Unit & Integration Tests

### File Location

```
packages/api/src/__tests__/partners.test.ts   ← procedures
packages/db/test/queries.test.ts               ← DB helpers
packages/ui/src/__tests__/utils.test.ts        ← pure utils
apps/web/src/__tests__/features/               ← hooks, client utils
```

### Structure Pattern

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("partners.list", () => {
  describe("filters", () => {
    it("excludes soft-deleted partners", async () => {
      /* ... */
    });
    it("excludes unpublished partners from public endpoint", async () => {
      /* ... */
    });
    it("applies country filter correctly", async () => {
      /* ... */
    });
  });

  describe("pagination", () => {
    it("returns correct nextCursor", async () => {
      /* ... */
    });
    it("returns no duplicates across pages", async () => {
      /* ... */
    });
  });

  describe("authorization", () => {
    it("is accessible to anonymous users", async () => {
      /* ... */
    });
  });
});
```

### Mock Patterns

```ts
// ✅ Mock Prisma with vi.mock
vi.mock("@kyc/db", () => ({
  prisma: {
    partner: {
      findMany: vi.fn().mockResolvedValue([mockPartner]),
      count: vi.fn().mockResolvedValue(1),
    },
  },
}));

// ✅ Mock Resend — never hit real email APIs
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "mock-id" }) },
  })),
}));

// ✅ Snapshot testing only for stable rendered output
// ❌ Never snapshot entire page components
```

### Authorization Test Pattern (Run for EVERY Procedure)

```ts
describe("memberProcedure", () => {
  it("throws UNAUTHORIZED when called anonymously", async () => {
    const ctx = createMockContext({ session: null });
    await expect(caller.favorites.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("adminProcedure", () => {
  it("throws FORBIDDEN when called by MEMBER role", async () => {
    const ctx = createMockContext({ session: memberSession });
    await expect(caller.admin.partners.create(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
```

## Playwright — E2E Tests

### Test Structure

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "../fixtures/auth.fixture";
import { PARTNER_SLUGS } from "../fixtures/seed-data";

test.describe("Catalog", () => {
  test("filters by country reduce partner list", async ({ page }) => {
    await page.goto("/ru/catalog");
    await page.getByTestId("catalog.filter.country").selectOption("UA");

    // ✅ Assert on visible content, not implementation
    await expect(page.getByTestId("partner.card")).toHaveCount({ min: 1 });

    // ✅ Assert URL reflects filter state (shareable)
    expect(page.url()).toContain("country=UA");
  });
});
```

### Playwright Rules

- Use `page.getByTestId(id)` as primary locator
- Use `page.getByRole(role, { name })` as secondary
- NEVER `page.locator('.some-css-class')` — CSS classes change
- NEVER `page.waitForTimeout(2000)` — use `expect(...).toBeVisible()`
- NEVER `test.only` in committed code
- ALWAYS use `loginAs` fixture for authenticated tests (reuse storage state)
- ALWAYS assert on the outcome state, not the intermediate loading state

### Cross-App Tests (admin → web)

```ts
test("publishing a partner appears on public catalog", async ({ browser }) => {
  // Admin context
  const adminCtx = await browser.newContext({
    storageState: "e2e/.auth/admin.json",
  });
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("http://localhost:3001/ru/partners/new");
  // … create + publish

  // Web context (separate browser context, no auth)
  const webCtx = await browser.newContext();
  const webPage = await webCtx.newPage();
  await webPage.goto("http://localhost:3000/ru/catalog");
  await expect(webPage.getByText(partnerName)).toBeVisible();
});
```

## Storybook Interaction Tests

```ts
// ✅ Test interactive behavior, not just rendering
export const WithFavoriteToggle: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const heart = canvas.getByRole("button", { name: /favorite/i });

    await step("Initial state", async () => {
      await expect(heart).toHaveAttribute("aria-pressed", "false");
    });

    await step("After toggle", async () => {
      await userEvent.click(heart);
      await expect(heart).toHaveAttribute("aria-pressed", "true");
    });
  },
};
```

## Test Data Rules

- Seed data IDs are in `e2e/fixtures/seed-data.ts` — use the named exports
- Do NOT hardcode IDs from previous test runs (they change on resetDb)
- Do NOT test against production data
- Build helpers for complex setup: `createApprovedMember(prisma, overrides)`

## Coverage Requirements

- Minimum thresholds (CI enforced): lines 70%, functions 70%, branches 60%
- Priority areas (aim for ≥ 85%):
  - `packages/api/src/routers/` — all procedure happy + error paths
  - `packages/api/src/lib/` — utilities and helpers
  - `packages/db/src/` — query helpers and search utils