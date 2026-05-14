---
title: Skill 08 — Push Notification (Web Push)
description: Use when adding a push notification trigger
trigger: "send push", "notify user", "web push", "web-push"
---

# Skill 08 — Push Notification (Web Push)

## When to Use

A user action should result in a browser/mobile push notification.

Examples: new message from manager, application approved, event reminder,
new promotion for favorited partner.

## Pre-Requisites

- VAPID keys generated and stored in env
  (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- Service worker handles `push` and `notificationclick` events (Block 21)
- `sendPushToUser` helper exists at `apps/web/src/server/push/webPush.ts`
- User has at least one `PushSubscription` row with the relevant channel enabled

## Sending a Push to One User

```ts
import { sendPushToUser } from "@/server/push/webPush";

// In a tRPC procedure:
export const featureRouter = router({
  doSomething: memberProcedure
    .input(/* ... */)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.something.create({ data: input });

      // Fire-and-forget — never await
      sendPushToUser(targetUserId, {
        title: "Заявка одобрена",
        body: "Добро пожаловать в KYLYVNYK CLUB!",
        url: "/ru/dashboard",
        tag: "application-approved", // dedupes successive same-tag notifications
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
      }).catch((err) => console.error("[push] sendPushToUser", err));

      return result;
    }),
});
```

## Channel Gating (Member Preferences)

`sendPushToUser` respects the user's per-channel preferences stored on
`PushSubscription.channels`. Pass the channel name:

```ts
sendPushToUser(userId, payload, { channel: "events" }).catch(console.error);
```

Channels available: `chat`, `applications`, `promotions`, `events`.

If the user has the channel disabled, the helper silently no-ops.

## Sending to Multiple Users (Broadcast)

Use the campaign infrastructure (Block 31) rather than rolling your own:

```ts
// Admin-side campaign creation (already covered by admin.push.campaigns.create)
// The campaign procedure resolves the audience and dispatches at scale.
```

For internal triggers (system events), use the trigger templates:

```ts
import { fireSystemTrigger } from "@/server/push/triggers";

await fireSystemTrigger("application_approved", {
  recipientUserId: newMember.userId,
  vars: {
    firstName: newMember.name,
    memberCardId: newMember.memberCardId,
  },
}).catch(console.error);
```

Trigger templates are admin-editable (admin.push.triggers in Block 31) so
copy can change without code deploys.

## Service Worker Behavior

The SW (set up in Block 21) handles incoming pushes:

```js
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/badge-72.png",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing tab if it's on the target URL
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
```

## Subscription Cleanup

`sendPushToUser` auto-prunes invalid endpoints:

- HTTP 404 / 410 → subscription deleted from DB (user uninstalled / revoked)
- Other errors → logged but row kept (transient failure)

## Testing

```ts
// Vitest mock:
vi.mock("@/server/push/webPush", () => ({
  sendPushToUser: vi.fn().mockResolvedValue({ ok: true }),
  sendPushToManyUsers: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}));

// In test:
expect(sendPushToUser).toHaveBeenCalledWith(
  expectedUserId,
  expect.objectContaining({ title: "Заявка одобрена" }),
);
```

## Payload Conventions

| Field   | Required | Notes                                                            |
| ------- | -------- | ---------------------------------------------------------------- |
| title   | yes      | Localized, max ~50 chars (mobile truncates)                      |
| body    | yes      | Localized, max ~150 chars                                        |
| url     | yes      | Path on our site — never external                                |
| tag     | yes      | Allows dedup: same tag = replaces previous notification          |
| icon    | no       | Defaults to `/icons/icon-192.png`                                |
| badge   | no       | Monochrome badge for Android status bar                          |
| actions | no       | Up to 2 inline actions (e.g., "Reply", "Open")                   |

## Anti-Patterns

```ts
// ❌ Awaiting push in critical path
await sendPushToUser(...)  // if Web Push is slow, member request stalls

// ❌ Sending hardcoded strings
sendPushToUser(userId, {
  title: 'Application approved',  // not localized
})

// ✅ Localize via user's stored locale
const user = await prisma.user.findUnique({ where: { id }, select: { locale: true }})
sendPushToUser(userId, {
  title: t({ ru: '...', en: '...', uk: '...' }, user.locale),
})

// ❌ Bypassing channel preferences
// Always pass { channel } so user opt-outs are honored

// ❌ Including sensitive data in payload
sendPushToUser(userId, {
  body: `Your password is ${plainPassword}`, // payload travels through push service
})
```

## Acceptance Criteria

- [ ] Call site is fire-and-forget (no `await`)
- [ ] Error caught and logged via `.catch(console.error)`
- [ ] Payload is localized for the recipient
- [ ] `tag` used for dedup
- [ ] `url` is a same-origin path
- [ ] Channel passed if user-pref-gated
- [ ] Vitest mock in tests

## Related Skills

- Skill 07 (email — same fire-and-forget pattern)
- Skill 02 (tRPC procedure triggering the push)