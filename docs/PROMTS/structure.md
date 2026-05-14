# Структура промптов Kylyvnyk Club

## 🏗 Фаза 0. Фундамент (8 блоков)

1. Инициализация Turborepo + pnpm workspace
2. packages/config — Tailwind preset, Biome, tsconfig
3. packages/db — Prisma + Supabase Postgres + seed
4. packages/api — tRPC роутер + Zod-схемы
5. packages/api — Rate limit (Upstash) + Audit log middleware ⭐
6. packages/ui — дизайн-система (shadcn + premium dark+gold)
7. packages/ui — Legal pages template + Cookie consent ⭐
8. packages/i18n — next-intl RU/EN/UK

## 🌐 Фаза 1. apps/web публичная часть (7 блоков)

1. Bootstrap apps/web — Next.js 15 + PWA (Serwist)
2. Auth.js v5 + Supabase Postgres + middleware защиты
3. Лендинг (главный экран макета №1) + GDPR-страницы
4. Форма заявки на карту → email менеджеру
5. Каталог партнёров — list page + полнотекстовый поиск ⭐
6. Детальная страница партнёра + Leaflet карта + рейтинги/отзывы
7. Промокоды публично: виджет «Горячие предложения» ⭐

## 👤 Фаза 2. Кабинет участника (8 блоков)

1. Layout кабинета + bottom-nav + onboarding-чеклист виджет ⭐
2. Главный экран кабинета: MembershipCard с QR
3. Избранное
4. История сделок + оставить отзыв (с модерацией в админке)
5. Реферальная программа
6. Профиль + настройки + Web Push subscription ⭐
7. События клуба: список + детальная + регистрация ⭐
8. Чат с менеджером (виджет + realtime через Supabase Realtime) ⭐

## 🛠 Фаза 3. apps/admin (8 блоков)

1. Bootstrap apps/admin + Auth.js + 2FA (TOTP) ⭐
2. CRUD Партнёры (i18n-поля, лого, скидки, категории) + soft-delete ⭐
3. CRUD Категории / Страны / Города (drag-n-drop порядок)
4. Заявки + участники (approve → создание Member + magic-link email)
5. CRUD Промокоды у партнёров (расписание, лимиты) ⭐
6. CRUD События (capacity, регистрации, чекин, напоминания) ⭐
7. Inbox чата (диалоги, ответы, назначения операторов) ⭐
8. Push-кампании (broadcast + триггеры) + Onboarding-чеклист editor +
   модерация отзывов + Audit log viewer ⭐
9. Dashboard метрики (recharts: участники, заявки, партнёры, чат-нагрузка)

## ✅ Фаза 4. Качество и релиз (3 блока)

1. Тесты (Vitest + Playwright) + Storybook stories
2. SEO + Sentry + PostHog + PWA-полиш + sitemap/OG
3. CI/CD GitHub Actions + Vercel (web + admin) + Prisma migrate deploy
