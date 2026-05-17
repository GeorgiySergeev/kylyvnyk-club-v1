# 🏛️ Kylyvnyk Club — International Business Club

> Premium mobile-first membership platform. Turborepo monorepo.

## Quick Start

### Prerequisites

| Tool              | Version  | Check              |
| ----------------- | -------- | ------------------ |
| Node.js           | 20.x LTS | `node -v`          |
| pnpm              | 9.x      | `pnpm -v`          |
| Git               | latest   | `git -v`           |
| Docker (optional) | latest   | для Supabase local |

### 1. Clone & Install

```bash
git clone https://github.com/GeorgiySergeev/kylyvnyk-club-v1.git
cd kylyvnyk-club-v1
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
# Заполни переменные — см. docs/ENV.md
```

### 3. Database Setup

```bash
pnpm --filter @kyc/db db:generate   # генерация Prisma Client
pnpm --filter @kyc/db db:migrate    # применение миграций (dev)
pnpm --filter @kyc/db db:seed       # заполнение demo-данными
```

### 4. Run Development

```bash
pnpm dev          # запускает все apps через Turborepo
# apps/web  → http://localhost:3000
# apps/admin → http://localhost:3001
```

### 5. Полезные команды

```bash
pnpm turbo run lint typecheck    # проверка перед PR
pnpm test                        # Vitest unit-тесты
pnpm e2e                         # Playwright E2E
pnpm build                       # production build всех приложений
```

## Monorepo Structure

```text
kylyvnyk-club-v1/
├── apps/
│   ├── web/       # Member portal (Next.js 15)
│   └── admin/     # CMS Admin (Next.js 15)
├── packages/
│   ├── ui/        # @kyc/ui — Shared UI components (CVA + shadcn)
│   ├── api/       # @kyc/api — tRPC routers + Zod schemas
│   ├── db/        # @kyc/db — Prisma + Supabase Postgres
│   ├── i18n/      # @kyc/i18n — next-intl RU/EN/UK
│   └── config/    # @kyc/config — Tailwind preset, Biome, tsconfig
├── e2e/           # Playwright E2E specs
├── docs/          # Project documentation
├── .cursor/rules/ # AI Agent rules
├── turbo.json
├── pnpm-workspace.yaml
└── AGENT.md
```

## Tech Stack

| Layer     | Technology                  |
| --------- | --------------------------- |
| Framework | Next.js 15 + React 19       |
| Language  | TypeScript 5 (strict)       |
| Styling   | Tailwind CSS v4             |
| API       | tRPC v11                    |
| Database  | Prisma + Supabase Postgres  |
| Auth      | Auth.js v5                  |
| i18n      | next-intl (RU / EN / UK)    |
| Testing   | Vitest + Playwright         |
| Monorepo  | Turborepo + pnpm workspaces |

## Locales

- 🇷🇺 Russian (ru) — primary
- 🇬🇧 English (en)
- 🇺🇦 Ukrainian (uk)

## Docs Index

- [Spec / ТЗ](docs/SPEC.md)
- [Environment Variables](docs/ENV.md)
- [Database ERD](docs/ERD.md)
- [Deployment](docs/DEPLOY.md)
- [Sprint Plan](docs/SPRINT.md)
- [Contributing](docs/CONTRIBUTING.md)
- [GDPR Policy](docs/GDPR.md)
- [Pre-Launch Checklist](docs/CHECKLIST.md)
