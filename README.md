# Time tracker

Личный трекер дня: план пишется накануне, утром день стартует и план замораживается,
в течение дня блоки трекаются таймером, вечером — итог и сводка для стендапа.

## Стек

Nuxt 4 (Vue 3 + TypeScript) · Postgres 17 · Drizzle ORM · Tailwind 4

## Запуск

```bash
cp .env.example .env
docker compose up -d      # Postgres на порту 5433
npm install
npm run db:push           # накатить схему
npm run dev               # http://localhost:3000
```

## Структура

```
app/pages/          страницы (файл = адрес)
app/components/     Vue-компоненты
server/api/         HTTP-эндпоинты
server/utils/       схема БД и запросы
shared/utils/       код, общий для фронта и сервера
```

## Ключевое решение

План на день замораживается в момент «Старт дня». Всё, что заведено после этого,
помечается `is_unplanned` — иначе план задним числом подгоняется под факт
и сравнивать становится не с чем.
