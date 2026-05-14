---
title: Skill 09 — Public Page with SEO
description: Use when creating a new SEO-optimized public page
trigger: "new public page", "landing page", "SEO page", "marketing page"
---

# Skill 09 — Public Page with SEO

## When to Use

You're adding a new route under `apps/web/src/app/[locale]/(marketing)/`
that should rank in search engines.

For member-area pages → see Skill 01.

## Steps

### 1. Define route + folder structure

```
apps/web/src/app/[locale]/(marketing)/<new-page>/
├─ page.tsx              ← main page (Server Component)
├─ opengraph-image.tsx   ← dynamic OG image (optional)
├─ loading.tsx           ← skeleton fallback
└─ [slug]/page.tsx       ← if dynamic detail pages
```

### 2. Implement `generateMetadata` with full i18n + hreflang

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";

type Props = { params: { locale: "ru" | "en" | "uk" } };

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "marketing" });

  const path = "/new-page";
  const canonicalUrl = `${env.NEXT_PUBLIC_SITE_URL}/${locale}${path}`;

  return {
    title: t("newPage.metaTitle"),
    description: t("newPage.metaDescription"),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ru: `${env.NEXT_PUBLIC_SITE_URL}/ru${path}`,
        en: `${env.NEXT_PUBLIC_SITE_URL}/en${path}`,
        uk: `${env.NEXT_PUBLIC_SITE_URL}/uk${path}`,
        "x-default": `${env.NEXT_PUBLIC_SITE_URL}/ru${path}`,
      },
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: t("newPage.metaTitle"),
      description: t("newPage.metaDescription"),
      locale,
      siteName: "Kylyvnyk Club",
      // opengraph-image.tsx is auto-discovered by Next.js
    },
    twitter: {
      card: "summary_large_image",
      title: t("newPage.metaTitle"),
      description: t("newPage.metaDescription"),
    },
  };
}
```

### 3. Server Component with parallel data fetch

```tsx
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { serverCaller } from "@/lib/trpc/server";
import { NewPageView } from "@/features/new-page/ui/NewPageView";

export default async function NewPage({
  params: { locale },
}: {
  params: { locale: "ru" | "en" | "uk" };
}) {
  const t = await getTranslations({ locale, namespace: "marketing" });

  // Parallel fetches — no waterfalls
  const [items, categories, countries] = await Promise.all([
    serverCaller.someRouter.list({ locale }),
    serverCaller.categories.list(),
    serverCaller.geo.listCountries(),
  ]);

  return (
    <>
      <JsonLd locale={locale} items={items} />
      <NewPageView
        t={t}
        items={items}
        categories={categories}
        countries={countries}
      />
    </>
  );
}
```

### 4. Add JSON-LD structured data

```tsx
// apps/web/src/features/new-page/ui/JsonLd.tsx
import { env } from "@/lib/env";

interface Props {
  locale: "ru" | "en" | "uk";
  items: SomeData;
}

export function JsonLd({ locale, items }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Page name",
    url: `${env.NEXT_PUBLIC_SITE_URL}/${locale}/new-page`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${env.NEXT_PUBLIC_SITE_URL}/${locale}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Page",
        },
      ],
    },
    // Other relevant schema.org types: ItemList, LocalBusiness, Event, FAQPage, etc.
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

Pick the right schema for your page:

| Page type             | Schema                |
| --------------------- | --------------------- |
| Homepage              | Organization + WebSite + SearchAction |
| Catalog list          | ItemList + BreadcrumbList |
| Partner / business    | LocalBusiness         |
| Event                 | Event                 |
| FAQ                   | FAQPage               |
| Article / blog        | Article + BreadcrumbList |
| Legal page            | WebPage + BreadcrumbList |

### 5. Dynamic OG image (optional but recommended)

`opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kylyvnyk Club — New Page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params: { locale },
}: {
  params: { locale: "ru" | "en" | "uk" };
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0E0E10 0%, #1C1C1E 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div style={{ fontSize: 84, color: "#D4AF37", fontFamily: "serif" }}>
          KYLYVNYK CLUB
        </div>
        <div style={{ fontSize: 36, color: "#E5E5EA", marginTop: 24 }}>
          {/* Localized tagline */}
        </div>
      </div>
    ),
    size,
  );
}
```

### 6. Register in sitemap

`apps/web/src/app/sitemap.ts` should auto-include all routes, but for
dynamic routes ensure they're enumerated:

```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;
  const locales = ["ru", "en", "uk"] as const;

  const staticPaths = ["", "/catalog", "/apply", "/new-page"];

  return staticPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1.0 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${baseUrl}/${l}${path}`]),
        ),
      },
    })),
  );
}
```

### 7. Add i18n keys

In all three `messages/<locale>/marketing.json`:

```json
{
  "newPage": {
    "metaTitle": "Заголовок страницы — KYLYVNYK CLUB",
    "metaDescription": "Описание для поисковиков, 150-160 символов",
    "h1": "Заголовок страницы",
    "subtitle": "Подзаголовок",
    "ctaPrimary": "Получить карту"
  }
}
```

### 8. Performance optimizations

- Hero image with `priority` prop on `<Image>`
- Below-the-fold images lazy-loaded (default)
- Use `<Suspense>` around any heavy sections so above-fold streams first
- Cache server data via `unstable_cache` with `revalidateTag`:

```ts
const items = await unstable_cache(
  () => serverCaller.someRouter.list({ locale }),
  ["new-page:items", locale],
  { tags: ["new-page:items"], revalidate: 300 },
)();
```

### 9. Test with Lighthouse

Before merging:

- Lighthouse mobile: Performance ≥ 90, SEO 100, A11y ≥ 95
- Check `/ru/new-page` has all three hreflang links
- Verify JSON-LD with [Google Rich Results Test](https://search.google.com/test/rich-results)
- Verify OG image renders correctly on Twitter/Facebook debuggers

## Acceptance Criteria

- [ ] `generateMetadata` returns title, description, canonical, hreflang (all 3 locales), openGraph, twitter
- [ ] JSON-LD structured data present and validates
- [ ] OG image renders (static fallback OR dynamic via opengraph-image.tsx)
- [ ] Page included in sitemap.xml
- [ ] Server-fetched data uses `Promise.all` (no waterfalls)
- [ ] Suspense boundaries for streaming
- [ ] All copy from i18n keys, no hardcoded strings
- [ ] Lighthouse SEO 100, Perf ≥ 90 (mobile)
- [ ] hreflang links inspected in DevTools `<head>`

## Related Skills

- Skill 03 (i18n keys for the page)
- Skill 02 (procedures for server-fetched data)