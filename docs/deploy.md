# Деплой «Вахты» на VPS (Docker + Caddy + Telegram)

## Что нужно заранее

1. **VPS** с Docker и Docker Compose (`docker compose version` должен работать). Хватит 1 vCPU / 1 ГБ.
2. **Домен**, направленный на IP сервера: A-запись `vakhta.example.com → <IP>`. Порты 80 и 443 открыты.
3. **Бот** в [@BotFather](https://t.me/BotFather):
   - `/newbot` → имя и username (например `vakhta_bot`) → получите **токен**;
   - `/newapp` → выберите бота → название, описание, картинка 640×360 → **Web App URL**: `https://vakhta.example.com` → короткое имя (например `game`). Итог — ссылка `https://t.me/vakhta_bot/game`.
   - Необязательно: `/setmenubutton` не нужен — сервер сам ставит кнопку меню «Играть».

## Первый запуск

```bash
git clone <репозиторий> vakhta && cd vakhta
cp .env.example .env
nano .env        # DOMAIN, BOT_TOKEN, BOT_USERNAME, APP_SHORT_NAME
docker compose up -d --build
docker compose logs -f app   # ждём "vakhta server on ..." и "bot polling"
```

Проверка: `https://vakhta.example.com/healthz` → `{"ok":true,...}`. Сертификат Caddy получает сам за ~10 секунд после первого запроса.

В Telegram: `/start` боту → кнопка «Играть» → открывается Mini App с вашим именем и фото.

## Обновление

```bash
git pull
docker compose up -d --build
```

Партии живут в памяти: при перезапуске контейнера текущие комнаты пропадают (игроки увидят «Связь потеряна» и вернутся на главную). Обновляйте, когда никто не играет.

## Переменные окружения

| Переменная | Что это |
| --- | --- |
| `DOMAIN` | домен без `https://`; Caddy выпускает для него сертификат, а сервер собирает `PUBLIC_URL` |
| `BOT_TOKEN` | токен из BotFather; без него бот выключен, вход только анонимный (по нику) |
| `BOT_USERNAME` | username бота без `@` — для ссылки-приглашения |
| `APP_SHORT_NAME` | короткое имя Mini App из `/newapp` — для ссылки `t.me/<bot>/<app>?startapp=<CODE>`. Необязательно: без него ссылка ведёт на бота (`t.me/<bot>?startapp=<CODE>`), что работает при включённом Main Mini App |

## Приглашения

Кнопка «Пригласить» в лобби открывает выбор чата в Telegram и отправляет другу сообщение с кнопкой «Войти в комнату» (для этого нужен `BOT_USERNAME`; бот готовит сообщение через Bot API). В старых клиентах Telegram и вне Telegram вместо этого отправляется ссылка.

Панель отладки (жук) на проде не показывается: она есть только в dev-сборке или при открытии страницы с `?debug`, и только в тренировке с ботами.

## Локальная разработка

```bash
npm install
npm run dev:server   # сервер комнат на :3000 (без бота, анонимный вход)
npm run dev          # Vite на :5173 с прокси /ws и /config.json на :3000
```

Открыть две вкладки `http://localhost:5173`: в первой «Создать игру», во второй — «Войти по коду» или `http://localhost:5173/r/<CODE>`.

## Если что-то не так

- **Mini App не открывается / белый экран** — проверьте, что `https://DOMAIN` открывается в обычном браузере и сертификат валиден (Telegram не открывает `http` и самоподписанные сертификаты).
- **«Не удалось войти»** — `BOT_TOKEN` в `.env` не совпадает с ботом, через которого открыт Mini App.
- **Ссылка-приглашение ведёт на сайт, а не в Telegram** — не заданы `BOT_USERNAME`/`APP_SHORT_NAME`.
- Логи: `docker compose logs -f app`, `docker compose logs -f caddy`.
