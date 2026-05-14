---
title: Skill 07 — Email Template
description: Use when adding a new transactional email (Resend)
trigger: "send email", "new email template", "notify by email"
---

# Skill 07 — Email Template

## When to Use

A tRPC procedure (or admin action) needs to send a transactional email.

Examples: welcome email, application approved, password changed,
event registered, review rejected.

## Pre-Requisites

- `RESEND_API_KEY` and `RESEND_FROM` configured in env
- A `sendEmail` helper exists at `apps/web/src/server/email/resend.ts`
- React Email package installed: `@react-email/components`

## Steps

### 1. Create the template

`apps/web/src/server/email/templates/feature-notification.tsx`:

```tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Hr,
  Img,
} from "@react-email/components";

interface FeatureNotificationProps {
  recipientName: string;
  actionUrl: string;
  locale: "ru" | "en" | "uk";
}

const COPY = {
  ru: {
    subject: "Уведомление от KYLYVNYK CLUB",
    greeting: (name: string) => `Здравствуйте, ${name}!`,
    body: "Текст уведомления.",
    cta: "Перейти",
    footer: "С уважением, команда KYLYVNYK CLUB",
  },
  en: {
    subject: "Notification from KYLYVNYK CLUB",
    greeting: (name: string) => `Hello, ${name}!`,
    body: "Notification body text.",
    cta: "Open",
    footer: "Best regards, KYLYVNYK CLUB team",
  },
  uk: {
    subject: "Сповіщення від KYLYVNYK CLUB",
    greeting: (name: string) => `Вітаємо, ${name}!`,
    body: "Текст сповіщення.",
    cta: "Перейти",
    footer: "З повагою, команда KYLYVNYK CLUB",
  },
};

export function FeatureNotificationEmail({
  recipientName,
  actionUrl,
  locale,
}: FeatureNotificationProps) {
  const t = COPY[locale];

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${process.env.NEXT_PUBLIC_SITE_URL}/img/logo-email.png`}
              width="160"
              alt="KYLYVNYK CLUB"
            />
          </Section>

          <Heading style={heading}>{t.greeting(recipientName)}</Heading>
          <Text style={paragraph}>{t.body}</Text>

          <Section style={ctaContainer}>
            <Button href={actionUrl} style={button}>
              {t.cta}
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const featureNotificationSubject = (locale: "ru" | "en" | "uk") =>
  COPY[locale].subject;

// Inline styles — required for email client compatibility
const body = { backgroundColor: "#0E0E10", padding: "40px 0" };
const container = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#1C1C1E",
  borderRadius: "12px",
  padding: "32px",
};
const header = { textAlign: "center" as const, marginBottom: "24px" };
const heading = {
  fontFamily: "Georgia, serif",
  fontSize: "28px",
  color: "#D4AF37",
  margin: "0 0 16px",
};
const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#E5E5EA",
  margin: "0 0 24px",
};
const ctaContainer = { textAlign: "center" as const, margin: "32px 0" };
const button = {
  backgroundColor: "#D4AF37",
  color: "#0E0E10",
  padding: "12px 32px",
  borderRadius: "8px",
  fontWeight: "600",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#3A3A3C", margin: "24px 0" };
const footer = { fontSize: "12px", color: "#8E8E93", textAlign: "center" as const };
```

### 2. Create the send function

```ts
// apps/web/src/server/email/templates/feature-notification.tsx (continued)
import { render } from "@react-email/components";
import { sendEmail } from "../resend";

export async function sendFeatureNotification(
  to: string,
  props: FeatureNotificationProps,
) {
  const html = await render(<FeatureNotificationEmail {...props} />);
  const text = await render(<FeatureNotificationEmail {...props} />, {
    plainText: true,
  });

  return sendEmail({
    to,
    subject: featureNotificationSubject(props.locale),
    html,
    text,
  });
}
```

### 3. Call from a tRPC procedure (fire-and-forget)

```ts
import { sendFeatureNotification } from "@/server/email/templates/feature-notification";

export const featureRouter = router({
  doSomething: memberProcedure
    .input(/* ... */)
    .mutation(async ({ ctx, input }) => {
      // 1. Critical operation (must succeed)
      const result = await ctx.prisma.something.create({ data: input });

      // 2. Email is non-critical — fire and forget
      sendFeatureNotification(ctx.session.user.email, {
        recipientName: ctx.session.user.name ?? "User",
        actionUrl: `${env.NEXT_PUBLIC_SITE_URL}/${ctx.session.user.locale}/dashboard`,
        locale: ctx.session.user.locale,
      }).catch((err) => console.error("[email] sendFeatureNotification", err));

      return result;
    }),
});
```

### 4. Test the template in dev

React Email comes with a dev preview:

```bash
# In apps/web:
pnpm exec react-email dev --dir src/server/email/templates
# Opens http://localhost:3001 with hot reload
```

### 5. Mock in tests

```ts
// In Vitest setup or per-test:
vi.mock("@/server/email/templates/feature-notification", () => ({
  sendFeatureNotification: vi.fn().mockResolvedValue({ id: "mock-id" }),
  featureNotificationSubject: () => "Mock subject",
}));
```

### 6. Add a dev-only inspection endpoint (if not exists)

`apps/web/src/app/api/dev/emails/route.ts` (already created in Block 33)
captures sent emails for E2E assertions.

## Checklist

- [ ] Subject in all 3 locales
- [ ] Body content in all 3 locales
- [ ] Logo image hosted at a public URL (use NEXT_PUBLIC_SITE_URL)
- [ ] Inline styles only (no external CSS — email clients strip it)
- [ ] CTA button with explicit href + aria-friendly text
- [ ] Plain-text fallback rendered via `render(..., { plainText: true })`
- [ ] Send call wrapped in `.catch(console.error)` in calling code
- [ ] Mocked in Vitest tests

## Anti-Patterns

```ts
// ❌ Blocking on email delivery
const result = await ctx.prisma.something.create(...)
await sendEmail(...)  // if Resend is down, mutation fails
return result

// ✅ Fire-and-forget
sendEmail(...).catch(console.error)
return result

// ❌ Translation via t() inside templates
// React Email runs server-side without i18n context — use COPY const map

// ❌ Inlining the email API key
const apiKey = "re_actual_key_here..."
// Use env.RESEND_API_KEY from validated env
```

## Acceptance Criteria

- [ ] Template renders in React Email preview
- [ ] All three locales tested visually
- [ ] Send call is non-blocking
- [ ] Test mock in place
- [ ] No secrets hardcoded

## Related Skills

- Skill 08 (push notification — same fire-and-forget pattern)
- Skill 02 (tRPC procedure triggering the email)