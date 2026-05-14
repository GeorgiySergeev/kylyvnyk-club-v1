---
title: Skill 03 — Add a New i18n Namespace
description: Use when introducing a new translation namespace
trigger: "new translations", "new namespace", "add i18n", "add messages"
---

# Skill 03 — Add a New i18n Namespace

## When to Use

You need a fresh group of message keys that doesn't fit existing namespaces.
Default rule: stay within existing namespaces unless the feature is large.

Available namespaces (do not duplicate):
`common · marketing · member · catalog · auth · applications · referrals ·
events · promotions · chat · notifications · onboarding · legal · admin · errors`

## Steps

### 1. Create three JSON files (one per locale)

```
packages/i18n/messages/ru/<namespace>.json
packages/i18n/messages/en/<namespace>.json
packages/i18n/messages/uk/<namespace>.json
```

All three MUST have identical key shape. RU is the source of truth.

### 2. Define keys with conventions

```json
{
  "title": "Заголовок",
  "subtitle": "Подзаголовок",
  "actions": {
    "save": "Сохранить",
    "cancel": "Отменить"
  },
  "form": {
    "fields": {
      "email": "Электронная почта",
      "phone": "Телефон"
    },
    "errors": {
      "required": "Поле обязательно",
      "invalidEmail": "Некорректный email"
    }
  },
  "stats": {
    "count": "{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элемента}}"
  }
}
```

Rules:

- camelCase keys
- Max 3 nesting levels
- ICU plural syntax for any counted noun
- Reuse existing terms — search before adding "save", "cancel", "loading"

### 3. Translate to EN and UK (real translations, not placeholders)

```json
// en/<namespace>.json
{
  "title": "Title",
  "stats": {
    "count": "{count, plural, one {# item} other {# items}}"
  }
}
```

```json
// uk/<namespace>.json
{
  "title": "Заголовок",
  "stats": {
    "count": "{count, plural, one {# елемент} few {# елементи} many {# елементів} other {# елемента}}"
  }
}
```

Plural rules per locale:

- RU/UK: `one`, `few`, `many`, `other`
- EN: `one`, `other`

### 4. Wire into types

`packages/i18n/src/types.ts` — ensure the new namespace is part of the
inferred `Messages` type. If using `as const` JSON imports, the type is
auto-derived; otherwise add to the union manually.

### 5. Verify parity

```bash
pnpm --filter @kyc/i18n test
```

The parity test fails if any locale is missing keys that exist in RU.

### 6. Use in code

Server Component:

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: "<namespace>" });
  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("stats.count", { count: 42 })}</p>
    </>
  );
}
```

Client Component:

```tsx
"use client";
import { useTranslations } from "next-intl";

export function MyComponent({ count }: { count: number }) {
  const t = useTranslations("<namespace>");
  return <span>{t("stats.count", { count })}</span>;
}
```

### 7. Verify in browser

```
http://localhost:3000/ru/...   ← RU strings
http://localhost:3000/en/...   ← EN strings
http://localhost:3000/uk/...   ← UK strings
```

## Acceptance Criteria

- [ ] All three locale files exist with identical key shape
- [ ] Parity test passes
- [ ] Plural keys use ICU syntax with correct locale-specific rules
- [ ] No literal strings remain in source — only `t()` calls
- [ ] Locale switching in the UI updates content without page reload

## Anti-Patterns

```ts
// ❌ Splitting count by suffix
"itemCount1": "1 элемент",
"itemCount2_4": "{n} элемента",
"itemCount5plus": "{n} элементов",

// ❌ Storing UI text in tRPC procedures
return { message: "Не удалось загрузить данные" }
// Instead: return { code: "load_failed" } — UI maps via errors.json

// ❌ Mixing concerns
// catalog.json containing admin-only labels
```