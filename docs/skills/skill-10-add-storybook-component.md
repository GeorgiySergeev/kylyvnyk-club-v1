---
title: Skill 10 — Add a Storybook Component
description: Use when adding a new component to @kyc/ui
trigger: "new component", "design system", "add to ui kit", "storybook"
---

# Skill 10 — Add a Storybook Component

## When to Use

You're adding a reusable UI primitive to `packages/ui` that will be consumed
by both `apps/web` and `apps/admin`.

For app-specific components (only used in one app), keep them inside
that app's `features/` or `widgets/` layer instead.

## Steps

### 1. Decide: primitive or custom?

- **Primitive**: a thin wrapper around Radix/shadcn (Button, Dialog, Tabs).
  Goes in `packages/ui/src/components/<primitive>.tsx`.
- **Custom**: project-specific composition (PartnerCard, MembershipCard,
  PromotionCard, BottomNav). Goes in `packages/ui/src/components/<custom>.tsx`.

If something similar already exists in `@kyc/ui` → extend it instead.

### 2. Implement the component

`packages/ui/src/components/MyComponent.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * MyComponent — short one-liner describing purpose.
 *
 * @example
 * <MyComponent variant="gold" size="md">Hello</MyComponent>
 */
const myComponentVariants = cva(
  // Base classes
  "inline-flex items-center justify-center rounded-md font-medium transition-all",
  {
    variants: {
      variant: {
        default: "bg-ink-800 text-ink-50 hover:bg-ink-700",
        gold: "bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-gold-glow",
        outline:
          "border border-gold-500/40 text-gold-400 hover:bg-gold-500/10",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {
  /** Whether the component is in a loading state */
  loading?: boolean;
}

export const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant, size, loading, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-testid="my-component"
        aria-busy={loading || undefined}
        className={cn(myComponentVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MyComponent.displayName = "MyComponent";
```

Requirements:

- [ ] Uses CVA for variants
- [ ] Uses `cn()` for className merge
- [ ] Forwards ref (`forwardRef`)
- [ ] Has `displayName`
- [ ] Has `data-testid` on root
- [ ] Has JSDoc with `@example`
- [ ] Has `aria-*` attributes where needed
- [ ] Does NOT import from `next/*` (framework-agnostic)
- [ ] Does NOT import from `react-router` or any app-level deps

### 3. Export from the barrel

`packages/ui/src/components/index.ts`:

```ts
// ...existing exports
export { MyComponent } from "./MyComponent";
export type { MyComponentProps } from "./MyComponent";
```

### 4. Create the Storybook story

`packages/ui/src/components/MyComponent.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { MyComponent } from "./MyComponent";

const meta: Meta<typeof MyComponent> = {
  title: "UI/MyComponent",
  component: MyComponent,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "gold", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    loading: { control: "boolean" },
  },
  parameters: {
    layout: "centered",
    backgrounds: { default: "ink" },
  },
};
export default meta;

type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: { children: "Default content" },
};

export const Gold: Story = {
  args: { variant: "gold", children: "Premium content" },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <MyComponent size="sm">Small</MyComponent>
      <MyComponent size="md">Medium</MyComponent>
      <MyComponent size="lg">Large</MyComponent>
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true, children: "Loading..." },
};
```

### 5. Add interaction tests (for interactive components)

If the component has user interactions (click, input, drag):

```tsx
import { within, userEvent, expect } from "@storybook/test";

export const WithInteraction: Story = {
  args: { children: "Click me", onClick: () => void 0 },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const component = canvas.getByTestId("my-component");

    await step("Renders with initial content", async () => {
      await expect(component).toHaveTextContent("Click me");
    });

    await step("Responds to click", async () => {
      await userEvent.click(component);
      // Assert side-effect via spy or aria state
    });
  },
};
```

### 6. Verify in Storybook

```bash
pnpm --filter @kyc/ui storybook
# Open http://localhost:6006
```

Check:

- All variants render
- Dark background looks right
- Keyboard navigation works
- A11y panel shows no violations (Storybook a11y addon)

### 7. Build verification

```bash
pnpm --filter @kyc/ui typecheck
pnpm --filter @kyc/ui build-storybook
pnpm --filter @kyc/ui test  # storybook test-runner if configured
```

### 8. Use in an app

```tsx
// apps/web/src/features/some-feature/ui/SomeView.tsx
import { MyComponent } from "@kyc/ui";

export function SomeView() {
  return <MyComponent variant="gold">Hello</MyComponent>;
}
```

## Anti-Patterns

```tsx
// ❌ Importing next/link or next/image in @kyc/ui
import Link from "next/link";
// Use plain <a> — apps will wrap with their own Link as needed

// ❌ Hardcoding colors
<div style={{ background: '#D4AF37' }} />
// Use Tailwind classes: <div className="bg-gold-500" />

// ❌ Inline variant strings without CVA
className={`btn btn-${variant} btn-${size}`}
// Use CVA — type-safe, composable

// ❌ Forgetting displayName (breaks devtools and React.memo equality)
export const Foo = forwardRef(...)
// Always: Foo.displayName = 'Foo'

// ❌ Skipping forwardRef
export function MyComponent({ ... }) { return <div ... /> }
// Use forwardRef — parents need refs for focus management, animations
```

## Acceptance Criteria

- [ ] Component uses CVA + cn + forwardRef + displayName
- [ ] Exported from `packages/ui/src/components/index.ts`
- [ ] Storybook story with Default + all variants + interactive states
- [ ] JSDoc with @example
- [ ] data-testid on root
- [ ] No Next.js imports
- [ ] No hardcoded colors
- [ ] Typecheck + Storybook build pass

## Related Skills

- Skill 01 (feature module that consumes the component)