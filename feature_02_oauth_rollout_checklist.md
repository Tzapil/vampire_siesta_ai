# Feature 02 Rollout Checklist

## Migration Checklist

1. Заполнить базовые env:
   - `MONGO_URL`
   - `ALLOWED_ORIGINS`
   - `SESSION_COOKIE_NAME`
   - `SESSION_TTL_DAYS`
   - `SESSION_SECURE`
   - `SESSION_SAMESITE`

2. Настроить хотя бы один OAuth-провайдер:
   - Google:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `GOOGLE_REDIRECT_URI`
   - Яндекс:
     - `YANDEX_CLIENT_ID`
     - `YANDEX_CLIENT_SECRET`
     - `YANDEX_REDIRECT_URI`

3. Для локальной разработки использовать callback именно на browser origin:
   - Google: `http://localhost:5173/api/auth/google/callback`
   - Яндекс: `http://localhost:5173/api/auth/yandex/callback`

4. Для production использовать публичный origin приложения:
   - Google: `https://<your-domain>/api/auth/google/callback`
   - Яндекс: `https://<your-domain>/api/auth/yandex/callback`

5. Для Яндекс OAuth убедиться, что приложению выданы права на email пользователя.
   - Аватар можно включить дополнительно, если он нужен в provider profile metadata.

6. Если приложение работает за reverse proxy и использует HTTPS:
   - установить `NODE_ENV=production`
   - установить `SESSION_SECURE=true`
   - убедиться, что публичный origin добавлен в `ALLOWED_ORIGINS`, если есть прямые cross-origin обращения

7. Перед rollout обновить зависимости окружения и перезапустить сервер.

## Smoke Checklist

1. Открыть `/auth/login` в новой сессии браузера.
2. Убедиться, что отображаются только реально настроенные провайдеры.
3. Выполнить вход через Google или Яндекс.
4. Проверить, что после логина происходит возврат на исходный `next`-маршрут.
5. Обновить страницу и убедиться, что сессия сохраняется.
6. Открыть `/profile`, изменить `displayName`, сохранить, проверить отображение в шапке после refresh.
7. Загрузить новый аватар и проверить его отображение в `/profile` и в header.
8. Выполнить logout и убедиться, что приватные маршруты снова редиректят на `/auth/login`.
9. Проверить, что прямой вызов приватного API без cookie возвращает `401`.
10. Проверить, что Socket.IO подключение без cookie отклоняется.
11. Проверить, что Socket.IO подключение после логина успешно.
12. Вручную заблокировать пользователя в MongoDB:
    - `db.users.updateOne({ email: "<email>" }, { $set: { status: "blocked" } })`
13. После блокировки убедиться, что следующий API-запрос или socket-событие завершает доступ пользователя.
