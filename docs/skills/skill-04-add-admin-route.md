---
title: Skill 04 — Add a New Admin Route
description: Use when adding a new section/page to apps/admin
trigger: "new admin page", "admin section", "admin module"
---

# Skill 04 — Add a New Admin Route

## When to Use

You need a new route or CRUD section inside `apps/admin`.

## Steps

### 1. Create the route placeholder

```
apps/admin/src/app/[locale]/(admin)/<route>/page.tsx
apps/admin/src/app/[locale]/(admin)/<route>/[id]/page.tsx   ← if CRUD
```

Server Component skeleton:

```tsx
import { getTranslations } from "next-intl/server";
import { serverCaller } from "@/lib/trpc/server";

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("<route>.title") };
}

export default async function Page() {
  const initialData = await serverCaller.admin.<route>.list({ limit: 50 });
  return <RouteListView initialData={initialData} />;
}
```

### 2. Register in sidebar

`apps/admin/src/components/shell/AdminNavItems.ts`:

```ts
export const adminNavItems: AdminNavItem[] = [
  // ...existing,
  {
    key: "new-route",
    icon: "Sparkles", // any lucide icon name
    href: "/<route>",
    roles: ["ADMIN", "SUPER_ADMIN"],
    section: "system", // or 'catalog', 'community', 'marketing'
  },
];
```

### 3. Add localized label

In all three locales of `admin.json`:

```json
// ru/admin.json
{
  "nav": {
    "newRoute": "Новый раздел"
  },
  "newRoute": {
    "title": "Новый раздел",
    "empty": "Пока пусто",
    "create": "Создать"
  }
}
```

### 4. Build the tRPC admin sub-router

`packages/api/src/routers/admin/<route>.ts`:

```ts
import { router } from "../../trpc";
import { auditedAdminProcedure, adminProcedure } from "../../trpc";

export const adminRouteRouter = router({
  list: adminProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      /* ... */
    }),

  create: auditedAdminProcedure({
    action: "route.create",
    entity: "Route",
  })
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  update: auditedAdminProcedure({
    action: "route.update",
    entity: "Route",
    selectEntityId: (input) => input.id,
  })
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  softDelete: auditedAdminProcedure({
    action: "route.softDelete",
    entity: "Route",
    selectEntityId: (input) => input.id,
  })
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      /* sets deletedAt */
    }),
});
```

Wire into the admin parent router:

```ts
// packages/api/src/routers/admin/index.ts
export const adminRouter = router({
  // ...existing,
  newRoute: adminRouteRouter,
});
```

### 5. Build the list page with DataTable

```tsx
// apps/admin/src/app/[locale]/(admin)/<route>/RouteList.tsx
"use client";

import { DataTable } from "@/components/data-table/DataTable";
import { columns } from "./columns";
import { trpc } from "@/shared/api/trpc-client";

export function RouteList({ initialData }: { initialData: ListOutput }) {
  const { data } = trpc.admin.newRoute.list.useQuery(
    { limit: 50 },
    { initialData },
  );

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      // sort/filter/pagination wired via URL state
    />
  );
}
```

`columns.tsx`:

```tsx
import type { ColumnDef } from "@tanstack/react-table";

export const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "nameRu",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("nav.newRoute")} />
    ),
  },
  // ...
  {
    id: "actions",
    cell: ({ row }) => <RowActions item={row.original} />,
  },
];
```

### 6. Build the form page (`/[id]` with id="new" for create)

```tsx
// apps/admin/src/app/[locale]/(admin)/<route>/[id]/page.tsx
import { serverCaller } from "@/lib/trpc/server";
import { RouteForm } from "./RouteForm";

export default async function Page({ params }: { params: { id: string } }) {
  const initialData =
    params.id === "new"
      ? null
      : await serverCaller.admin.newRoute.get({ id: params.id });
  return <RouteForm initialData={initialData} />;
}
```

Form pattern uses RHF + zodResolver:

```tsx
"use client";

const form = useForm<FormSchema>({
  resolver: zodResolver(formSchema),
  defaultValues: initialData ?? defaults,
});

const createMutation = trpc.admin.newRoute.create.useMutation({
  onSuccess: (created) => {
    toast.success(t("created"));
    router.push(`/${locale}/<route>/${created.id}`);
  },
  onError: (err) => toast.error(t(err.message)),
});

const updateMutation = trpc.admin.newRoute.update.useMutation({
  onSuccess: () => toast.success(t("saved")),
  onError: (err) => toast.error(t(err.message)),
});
```

### 7. Add row actions

```tsx
// apps/admin/src/app/[locale]/(admin)/<route>/RowActions.tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <MoreVertical />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => router.push(`/${locale}/<route>/${id}`)}>
      {t('common.edit')}
    </DropdownMenuItem>
    <DropdownMenuItem
      className="text-danger"
      onClick={() => setDeleteOpen(true)}
    >
      {t('common.delete')}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
  <AlertDialogContent>
    <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
    <AlertDialogDescription>{t('confirmDeleteDesc')}</AlertDialogDescription>
    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
    <AlertDialogAction
      variant="destructive"
      onClick={() => deleteMutation.mutate({ id })}
    >
      {t('common.delete')}
    </AlertDialogAction>
  </AlertDialogContent>
</AlertDialog>
```

### 8. Cache invalidation

If the route manages publicly-visible data:

```ts
import { revalidateTag } from "next/cache";

// At end of create/update/delete mutations:
revalidateTag("<feature>:list");
```

### 9. Tests

- Vitest: all CRUD procedures with role checks (MEMBER → FORBIDDEN)
- Playwright: `e2e/admin/<route>.spec.ts` — create → edit → soft-delete

## Acceptance Criteria

- [ ] Route appears in sidebar with correct icon and label
- [ ] List page uses DataTable with cursor pagination
- [ ] Create/edit form with RHF + Zod
- [ ] All mutations use `auditedAdminProcedure`
- [ ] Soft delete (sets `deletedAt`) — never hard delete from admin UI
- [ ] Destructive action requires AlertDialog confirmation
- [ ] Cache invalidated for public data
- [ ] i18n labels in all three locales
- [ ] Playwright E2E covers happy path

## Related Skills

- Skill 02 (tRPC procedures used by the route)
- Skill 03 (i18n labels)
- Skill 05 (DB changes if needed)