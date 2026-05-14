---
description: Apply when building React components, pages, or editing packages/ui
globs: ["packages/ui/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"]
alwaysApply: true
---

# Premium UI Rules — Dark + Gold Aesthetic

## Design Token Usage

Only use Tailwind classes referencing the approved palette:

```tsx
// ✅ Correct
<div className="bg-ink-900 border border-gold-500/30 text-ink-50" />

// ❌ Never hardcode
<div style={{ background: '#0E0E10', borderColor: '#D4AF37' }} />

// ❌ Never use default Tailwind colors for surfaces
<div className="bg-zinc-900" />  // use bg-ink-900
<div className="bg-yellow-500" /> // use bg-gold-500
```

## Component Pattern — CVA + Tailwind

```tsx
// ✅ Every variant component uses CVA
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@kyc/ui/lib/cn";

const buttonVariants = cva(
  // base classes
  "inline-flex items-center justify-center rounded-md font-medium transition-all",
  {
    variants: {
      variant: {
        gold: "bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-gold-glow",
        ghost: "bg-transparent text-ink-50 hover:bg-ink-800",
        outline:
          "border border-gold-500/40 text-gold-400 hover:bg-gold-500/10",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

## Animation Rules (Framer Motion)

- Entrance animations: opacity 0 → 1, y 8 → 0, duration 0.3s ease-out
- Hover: scale 1.02 max — never more on cards/buttons
- Disabled when `NEXT_PUBLIC_DISABLE_ANIMATIONS=1` via `MotionConfig`
- Page transitions: max 0.2s — never block perceived navigation

```tsx
// ✅ Use whileInView for sections, not useEffect + IntersectionObserver
<motion.div
  initial={{ opacity: 0, y: 8 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-50px" }}
  transition={{ duration: 0.3, ease: "easeOut" }}
/>
```

## Loading States — Every Async UI Needs One

```tsx
// ✅ Every server component has a Suspense boundary with a skeleton
<Suspense fallback={<PartnerCardSkeleton count={6} />}>
  <PartnerGrid />
</Suspense>;

// ✅ Every client mutation shows a loading indicator
const { mutate, isPending } = trpc.favorite.toggle.useMutation();
<Button disabled={isPending}>
  {isPending ? <Spinner size="sm" /> : <HeartIcon />}
</Button>;
```

## Empty States — Required

Every list/grid must handle the empty case:

```tsx
if (items.length === 0) {
  return (
    <EmptyState
      icon={<HeartIcon className="text-gold-500" />}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={<GoldButton href="/catalog">{t("exploreButton")}</GoldButton>}
    />
  );
}
```

## Accessibility Checklist (Apply to Every New Component)

- [ ] Interactive elements are `<button>` or `<a>`, never `<div onClick>`
- [ ] Icon-only buttons have `aria-label` or `<span className="sr-only">`
- [ ] Images have descriptive `alt` (not "image" or "logo")
- [ ] Focus rings visible: `focus-visible:ring-2 focus-visible:ring-gold-500`
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text
- [ ] Form fields have `<label>` associated via `htmlFor`
- [ ] Dialogs/Sheets trap focus; ESC closes; returns focus to opener
- [ ] Lists are `<ul>/<ol>` with `<li>`, not nested divs
- [ ] Loading/skeleton has `aria-busy="true"`
- [ ] Dynamic content uses `aria-live="polite"` (e.g., search results count)

## Responsive Design Convention

- Mobile-first (base styles = mobile, `md:` = tablet, `lg:` = desktop)
- Bottom nav visible below `md`; sidebar visible at `lg` and above
- Touch targets: min 44×44px (`min-h-[44px] min-w-[44px]`)
- Horizontal scroll areas: `overflow-x-auto scroll-smooth snap-x snap-mandatory`

## Image Guidelines

```tsx
// ✅ Always next/image with explicit dimensions or fill
import Image from "next/image";
<Image
  src={partner.logoUrl}
  alt={partner.name}
  width={64}
  height={64}
  className="rounded-full object-cover"
/>;

// ✅ Priority only on the first visible above-the-fold image
<Image src={heroGlobe} alt="" priority />;

// ❌ Never <img> without height/width (causes CLS)
```

## New Component Checklist

Before committing a new component to @kyc/ui:

- [ ] Uses CVA for variants (if it has variants)
- [ ] Uses `cn()` for className merge
- [ ] Has a Storybook story (`*.stories.tsx`)
- [ ] Is exported from `packages/ui/src/components/index.ts`
- [ ] Does NOT import from Next.js (`next/link`, `next/image`, `next/navigation`)
- [ ] Server-Component-safe (no top-level hooks; hooks in `"use client"` variant)
- [ ] Has `data-testid` on the root element
- [ ] JSDoc comment on the component function