# SKILLS — Index

> Quick reference for Kylyvnyk Club skill playbooks: one focused file per
> task type. Open only the skill you need; do not load everything at once.

## Available skills

<!-- markdownlint-disable MD013 MD060 -->

| #   | Skill                     | When to use                                     | File                                                                         |
| --- | ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| 01  | Add a New Feature Module  | New capability across DB + API + UI + admin     | [skill-01-add-feature-module.md](./skill-01-add-feature-module.md)           |
| 02  | Add a New tRPC Procedure  | Single new endpoint on an existing router       | [skill-02-add-trpc-procedure.md](./skill-02-add-trpc-procedure.md)           |
| 03  | Add a New i18n Namespace  | New translation group / messages bundle         | [skill-03-add-i18n-namespace.md](./skill-03-add-i18n-namespace.md)           |
| 04  | Add a New Admin Route     | New section or CRUD inside `apps/admin`         | [skill-04-add-admin-route.md](./skill-04-add-admin-route.md)                 |
| 05  | Database Schema Change    | Prisma schema (model, column, index, migration) | [skill-05-database-schema-change.md](./skill-05-database-schema-change.md)   |
| 06  | Optimistic UI Update      | Mutation should feel instant (toggles, likes)   | [skill-06-optimistic-ui-update.md](./skill-06-optimistic-ui-update.md)       |
| 07  | Email Template            | New transactional email (e.g. Resend)           | [skill-07-email-template.md](./skill-07-email-template.md)                   |
| 08  | Push Notification         | Web Push for one or many users                  | [skill-08-push-notification.md](./skill-08-push-notification.md)             |
| 09  | Public Page with SEO      | New SEO-oriented public / marketing page        | [skill-09-public-page-with-seo.md](./skill-09-public-page-with-seo.md)       |
| 10  | Add a Storybook Component | New reusable primitive in `@kyc/ui`             | [skill-10-add-storybook-component.md](./skill-10-add-storybook-component.md) |

## Reference material

| Doc                       | Purpose                                | File                                       |
| ------------------------- | -------------------------------------- | ------------------------------------------ |
| Common Mistakes Reference | Anti-patterns before commit            | [common-mistakes.md](./common-mistakes.md) |
| AGENT.md                  | Master agent constraints               | [AGENT.md](../AGENT.md)                    |
| Cursor Rules              | Auto-loaded rules (architecture, etc.) | [.cursor/rules/](../.cursor/rules/)        |

<!-- markdownlint-enable MD013 MD060 -->

## How to use skills

<!-- markdownlint-disable MD013 MD060 -->

### As a developer

| Step | What to do                                             |
| ---- | ------------------------------------------------------ |
| 1    | Pick the skill that matches the task before you start. |
| 2    | Read **When to Use** in that file to confirm it fits.  |
| 3    | Follow the steps in order.                             |
| 4    | Satisfy **Acceptance Criteria** before opening a PR.   |
| 5    | Skim **Common Mistakes Reference** as a final pass.    |

### As an AI agent (Cursor)

| Step | What to do                                                     |
| ---- | -------------------------------------------------------------- |
| 1    | Map the user request to one skill (see triggers in each file). |
| 2    | Read only that skill file end-to-end.                          |
| 3    | Execute its steps; do not improvise a parallel process.        |
| 4    | Verify against that file’s acceptance criteria.                |
| 5    | Cross-check `common-mistakes.md` before marking the task done. |

## Adding a new skill

| Step | Action                                                               |
| ---- | -------------------------------------------------------------------- |
| 1    | Add `docs/skills/skill-NN-<kebab-name>.md` using the template below. |
| 2    | Add a row to the **Available skills** table in this file.            |
| 3    | Add a trigger row in `.cursor/rules/skills.md`.                      |

<!-- markdownlint-enable MD013 MD060 -->

Router: `.cursor/rules/skills.md` maps keywords to these files in
`docs/skills/`.

### Template

```markdown
---
title: Skill NN — <Title>
description: Use when <one-line condition>
trigger: "<keyword1>", "<keyword2>", "<keyword3>"
---

# Skill NN — <Title>

## When to Use

<Concrete scenarios>

## Prerequisites

<What must be in place>

## Steps

### 1. <First step>

### 2. <Second step>

...

## Acceptance Criteria

- [ ] ...
- [ ] ...

## Anti-Patterns

<Common mistakes specific to this skill>

## Related Skills

- Skill XX (...)
```
