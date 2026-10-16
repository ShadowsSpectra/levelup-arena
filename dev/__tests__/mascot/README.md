# Mascot Playground (development only)

Run from the project root:

```sh
npm run dev:mascot
```

Open **http://127.0.0.1:5180/**. Stop with Ctrl+C.
The server binds to loopback and refuses to use another port silently.

This is a separate Vite root/HTML entry, with no App imports, game routes,
AI endpoints, storage, or progression. The ordinary `npm run dev`, `npm run build`
and `npm start` entries remain unchanged. The Playground config refuses builds
and preview. Its HTML, React code and styles are not included in the app bundle.
The original PNGs in `public/mascot/` are static public assets and, like other
public assets, are copied into `dist`; this does not enable a Playground route.

The HTML entry lives under `dev/__tests__/mascot` so Vite's default application
dependency scan skips it as well; no production/development app config changes
are necessary.

Controls: idle/happy/judge/point, 56/96/160 px, tail motion, all animations,
and local sample speech. Clicking happy again replays the short joy animation.
Blinking happens after 2.8–5.2 seconds, for 150 ms, in idle and point only.
Reduced-motion disables all animation, including blinking.

The seven original 1254×1254 transparent PNGs are left untouched. Body frames
already include a tail; a CSS alpha mask subtracts `cat-tail.png` from the body
layer while the same tail image is rendered underneath. This requires a browser
with CSS `mask-composite: subtract` support. The tail uses the supplied canvas
alignment; assets with different alignment will require visual adjustment here
before any future game integration.

## LeviTour: первый шаг (только dev)

Запуск: `npm run dev:mascot`, затем `http://127.0.0.1:5180/levi-tour.html`.
Если порт 5180 занят старым процессом, используйте `npm run dev:mascot -- --port 5181`
и `http://127.0.0.1:5181/levi-tour.html`. Остановка — Ctrl+C в запустившем сервер терминале.

Страница использует настоящий RoleSelectionPage. Первое приветствие через 4.5 секунды
сменяется вторым; «Дальше» переключает раньше. Клик по карточке, Enter или Space
доступен в обоих приветствиях и показывает случайную реакцию именно выбранной роли.
Реакция сохраняется до «Продолжить», пропуска или следующего явного выбора роли.
При повторном запуске в рамках этого экрана предыдущая реплика той же роли исключается.
Выбор в dev-предпросмотре остаётся только в памяти и не сохраняет роль или progression.
Home пока не подключён: «Продолжить» просто закрывает реакцию.

Режим «Данные этого браузера» использует отдельный ключ
`levelup-arena:levi-tour-dev-role-slice` в localStorage текущего origin. Только
«Продолжить» и «Пропустить» записывают временную отметку первого среза. Выбор роли
и показ реакции ничего не записывают. После закрытия/пропуска обновите страницу:
автоматический показ среза больше не происходит. «Повторить экскурсию» работает
без удаления отметок. Старый `levelup-arena:onboarding-complete` и полный
`levelup-arena:levi-tour-version` не участвуют в проверке этого dev-среза.
Существующий полный ключ, включая преждевременно записанное `1`, не изменяется и
не удаляется. Решение о миграции этого тестового значения нужно принять перед
подключением полной экскурсии к production; текущий dev-срез не подтверждает её
прохождение. localStorage зависит от
порта: данные на 5180/5181 не совпадают с данными основного приложения на 5173.

«Проверить существующего пользователя» создаёт изолированные данные в памяти:
старый onboarding пройден, выбрана Sales Manager, есть XP/Energy/Streak. Экскурсия
покажется автоматически. Выберите другую роль в предпросмотре — сохранённая Sales
Manager останется прежней. Проверьте повторный запуск и пропуск. Повторное нажатие
«Проверить существующего пользователя» создаёт новый тестовый снимок; данные
браузера оно не читает и не перезаписывает.

LeviTour не подключён к App или старому OnboardingPage и не входит в production bundle.
Подсветка карточек начинается только со второй реплики, после таймера или «Дальше».
Она использует data-tour атрибуты: один мягкий акцент переходит к
следующей карточке каждые 1.5 секунды в порядке DOM. Первое наведение или фокус
останавливает автоперебор до повторного запуска, подсветкой управляет пользователь.
Выбор роли, пропуск и размонтирование очищают таймеры и подсветку. Это только
оформление: клики и aria-pressed не изменяются. Леви находится в потоке страницы;
на мобильном он расположен над облачком, а служебные dev-панели находятся ниже выбора
ролей. Допустима прокрутка. Системное уменьшение движения отключает анимации
Mascot, смены текста и цикл подсветки (остаётся статичное выделение).
