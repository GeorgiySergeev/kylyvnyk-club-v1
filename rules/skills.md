---
description: Skill router — when user requests match known patterns, read the matching skill file from docs/skills/ FIRST, then execute
alwaysApply: true
---

# Skill Router

Before implementing any non-trivial task, check if it matches a known skill
in `docs/skills/`. If yes — read that file first, then follow its steps
exactly. If no — proceed using AGENT.md constraints.

## Trigger Mapping

Full human-readable index: [`docs/skills/SKILLS.md`](../docs/skills/SKILLS.md).

<!-- markdownlint-disable MD013 MD060 -->

| Task pattern keywords                                             | Skill file                                      |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| "new feature", "create module", "add feature", "new section"      | docs/skills/skill-01-add-feature-module.md      |
| "add procedure", "new endpoint", "tRPC query", "tRPC mutation"    | docs/skills/skill-02-add-trpc-procedure.md      |
| "new translations", "new namespace", "add i18n", "add messages"   | docs/skills/skill-03-add-i18n-namespace.md      |
| "new admin page", "admin section", "admin module", "admin CRUD"   | docs/skills/skill-04-add-admin-route.md         |
| "schema change", "add column", "new model", "migration", "prisma" | docs/skills/skill-05-database-schema-change.md  |
| "optimistic", "instant toggle", "feel snappy", "no loading flash" | docs/skills/skill-06-optimistic-ui-update.md    |
| "send email", "new email template", "notify by email"             | docs/skills/skill-07-email-template.md          |
| "send push", "notify user", "web push", "push notification"       | docs/skills/skill-08-push-notification.md       |
| "new public page", "landing page", "SEO page", "marketing page"   | docs/skills/skill-09-public-page-with-seo.md    |
| "new component", "design system", "add to ui kit", "storybook"    | docs/skills/skill-10-add-storybook-component.md |

<!-- markdownlint-enable MD013 MD060 -->

## After Writing Code

Always cross-check the result against `docs/skills/common-mistakes.md`
before declaring the task done. Fix any anti-pattern that matches.

## Skill Composition

Many real tasks combine multiple skills. Example: "Add a Loyalty Tiers
feature" likely uses:

1. **Skill 05** (Database) — new `LoyaltyTier` model
2. **Skill 02** (tRPC) — procedures to list/award tiers
3. **Skill 03** (i18n) — new namespace `loyalty.json`
4. **Skill 10** (UI) — `<TierBadge>` component in @kyc/ui
5. **Skill 04** (Admin) — admin CRUD page
6. **Skill 01** (Feature) — orchestrating everything above

When composing skills, follow them in the order above (data → API → UI →
admin → tests), and verify each skill's acceptance criteria before moving
on to the next.

## When in Doubt

If the user's request doesn't clearly match a single skill:

1. Ask: "This task seems to combine Skills X, Y, and Z. Should I proceed
   in that order?"
2. Or propose a new skill if the pattern recurs.

Never invent a workflow that contradicts an existing skill — extend or
update the skill instead.
