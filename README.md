# Vampire Siesta — инструкция по запуску

Проект: веб‑приложение для ведения листа персонажа Vampire: The Masquerade (V20).  
Монорепозиторий на `npm workspaces`: клиент (React + Vite) и сервер (Express + Socket.IO + MongoDB).

## Быстрый обзор

- Dev‑режим: клиент и сервер запускаются параллельно (`npm run dev`).
- Prod‑режим: сервер раздаёт статические файлы клиента (нужен `NODE_ENV=production`).
- База данных: MongoDB.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения.

```env
PORT=4000
MONGO_URL=mongodb://localhost:27017/siesta
```

Дополнительно:

- `CLIENT_DIST_PATH` — путь до собранного клиента. Нужен, если вы запускаете сервер НЕ из корня репозитория.
- `NODE_ENV=production` — включает раздачу клиента сервером.

## Локальный запуск (dev)

### Требования

- Node.js 20+ и npm
- MongoDB 6+ (локально) **или** Docker для запуска MongoDB
- Git

### 1) Установка зависимостей

```bash
npm install
```

### 2) Запуск MongoDB

Вариант A — локальная MongoDB:

- Установите MongoDB 6+ и убедитесь, что служба запущена.
- Укажите `MONGO_URL` в `.env`.

Вариант B — MongoDB в Docker:

```bash
docker run -d \
  --name siesta-mongo \
  -p 27017:27017 \
  -v siesta-mongo:/data/db \
  mongo:6
```

### 3) Сидирование справочников

```bash
npm run seed
```

### 4) Запуск dev‑режима

```bash
npm run dev
```

- Клиент запустится через Vite (порт по умолчанию отображается в консоли).
- Сервер по умолчанию слушает `PORT` из `.env` (обычно 4000).

## Локальный запуск (prod без Docker)

### 1) Сборка

```bash
npm run build
```

### 2) Запуск сервера

Запускать из корня репозитория:

```bash
set NODE_ENV=production
set PORT=4000
set MONGO_URL=mongodb://localhost:27017/siesta
node apps/server/dist/index.js
```

Если запускаете сервер не из корня, задайте `CLIENT_DIST_PATH` вручную:

```bash
set CLIENT_DIST_PATH=D:\projects\siesta_ai\apps\client\dist
```

## Запуск через Docker Compose (локально или на VPS)

### Требования

- Docker Engine
- Docker Compose (plugin)

### 1) Подготовка `.env`

```bash
copy .env.example .env
```

Отредактируйте `MONGO_URL` при необходимости. Для docker‑compose можно использовать:

```env
MONGO_URL=mongodb://mongo:27017/siesta
```

### 2) Сборка и запуск

```bash
docker compose up -d --build
```

Сервис `app` слушает `PORT` (по умолчанию 4000). Статический клиент раздаётся сервером.

### 3) Остановка

```bash
docker compose down
```

## VPS запуск (рекомендуемый вариант: Docker Compose)

### Что установить на VPS

- Docker Engine
- Docker Compose (plugin)
- Git

### 1) Клонирование и подготовка

```bash
git clone <ваш-репозиторий>
cd siesta_ai
copy .env.example .env
```

Отредактируйте `.env`:

```env
PORT=4000
MONGO_URL=mongodb://mongo:27017/siesta
```

### 2) Запуск

```bash
docker compose up -d --build
```

### 3) Обновление версии

```bash
git pull

docker compose up -d --build
```

### 4) Порты и доступ

- Откройте входящий порт `PORT` (обычно 4000) на фаерволе.
- Для домена обычно ставят reverse‑proxy (Nginx/Caddy). В этом случае проксируйте запросы на `http://127.0.0.1:4000`.

## VPS запуск без Docker (Node + MongoDB)

### Что установить

- Node.js 20+
- MongoDB 6+
- Git
- (опционально) pm2 для управления процессом

### 1) Установка и сборка

```bash
git clone <ваш-репозиторий>
cd siesta_ai
npm install
npm run build
npm run seed
```

### 2) Запуск (один процесс)

```bash
export NODE_ENV=production
export PORT=4000
export MONGO_URL=mongodb://localhost:27017/siesta
node apps/server/dist/index.js
```

### 3) Запуск через pm2 (рекомендуется)

```bash
npm install -g pm2
pm2 start apps/server/dist/index.js --name siesta
pm2 save
```

## Полезные команды

```bash
npm run typecheck
npm run seed
```

## Частые проблемы

- Нет справочников: убедитесь, что `npm run seed` выполнен и MongoDB доступна.
- Клиент не раздаётся в проде: проверьте `NODE_ENV=production` и `CLIENT_DIST_PATH`.
- Ошибка подключения к БД: проверьте `MONGO_URL` и доступность MongoDB.
