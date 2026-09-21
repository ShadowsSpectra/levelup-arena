# LevelUP Arena

Игровой тренажёр переговоров на React, TypeScript и Vite.

## Локальный запуск

1. Установите актуальную LTS-версию [Node.js](https://nodejs.org/).
2. Откройте терминал в папке проекта.
3. Выполните `npm install`.
4. Выполните `npm run dev`.
5. Откройте адрес, который появится в терминале (обычно `http://localhost:5173`).

## Команды

- `npm run dev` — запустить приложение для разработки.
- `npm run typecheck` — проверить TypeScript.
- `npm test` — проверить правила Training и прогрессии.
- `npm run build` — собрать production-версию.
- `npm run preview` — локально открыть собранную production-версию.

## Структура `src`

- `pages` — страницы приложения;
- `components` — переиспользуемые UI-компоненты;
- `config` — настройки XP, уровней, Energy и ролей;
- `content` — вопросы и сценарии;
- `services` — игровая логика, хранение и будущие интеграции;
- `state` — состояние пользователя;
- `styles` — общие стили.

## Training-контент

Тестовые задания находятся в `src/content/questions.json`. Каждое задание —
отдельный JSON-объект с уникальным `id`. Чтобы временно скрыть задание, установите
`"active": false`.

Поле `correctAnswer` содержит индекс правильного варианта и начинается с нуля:
`0` — первый ответ, `1` — второй, `2` — третий, `3` — четвёртый. После редактирования запустите
`npm run typecheck` и `npm run build`.

Приложение получает контент через интерфейс `QuestionSource` в
`src/content/questionSource.ts`. В будущем локальную реализацию можно заменить
источником из облачной таблицы, не меняя Training UI и Training Engine.

## Прогрессия

Пороги уровней и правила Energy находятся в `src/config/progression.ts`.
Начисление XP, streak и разблокировка Arena рассчитываются в
`src/services/progression.ts`, отдельно от Training UI. XP и Arena Unlock
принадлежат выбранной роли; Energy и streak общие.

Данные сохраняются локально в браузере под ключом
`levelup-arena:progression-v1`. Авторизация и сервер пока не используются.
