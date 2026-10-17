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

## LeviTour: этап 2, Role Selection → Home (только dev)

Запуск: `npm run dev:mascot`, затем `http://127.0.0.1:5180/levi-tour.html`.
Если порт 5180 занят старым процессом, используйте `npm run dev:mascot -- --port 5181`
и `http://127.0.0.1:5181/levi-tour.html`. Остановка — Ctrl+C в запустившем сервер терминале.

Страница использует настоящие RoleSelectionPage, RoleHomePage и AppHeader. App и
useAppState не изменены: dev-обвязка хранит переходы и роль в памяти. Из игрового
localStorage читается только снимок; его роль, progression и история никогда не
перезаписываются. Home получает реальный getRoleProgress, а не декоративную копию статистики.

Для полного прохода нажмите «Проверить нового пользователя»: это свежий снимок
в памяти, не удаление данных браузера. Первое приветствие через 4.5 секунды
сменяется вторым; «Дальше» переключает раньше. Карточки доступны в обеих репликах.
Выберите любую роль — немедленно откроется Home со случайной фиксированной реакцией
из существующего набора. Подтверждения роли и промежуточного «Продолжить» нет.
Через 4.5 секунды реакция автоматически сменяется объяснением Level/XP;
«Дальше →» позволяет перейти раньше. Остальные шаги Home переключаются вручную.

Далее «Дальше →» последовательно показывает Level/XP, Energy/Streak, настоящую
карточку Training и всю карточку Arena. Подсветка предыдущей группы
снимается. На шаге Arena «Дальше» только фокусирует настоящую кнопку «Открыть арену»;
нажмите её самостоятельно. После нажатия показывается финальная реплика и «Готово».
Это явно обозначенный dev-preview на Home: Arena Setup/переговоры не смонтированы,
фиктивные оппоненты и сценарии не создаются. Training и AI Settings также обозначают
границу подключения: их кнопки дают dev-сообщение, а не запускают сессию/API.

«Пропустить экскурсию» доступно во всех фазах. До выбора роли пропуск оставляет
карточки доступными; последующий выбор всё равно открывает Home, но уже без реакции.
На Home и в финале пропуск убирает Леви и подсветку, сохраняя текущую роль и снимок.
«Сменить роль» прекращает текущую экскурсию без автоматического запуска новой.

Режим «Данные этого браузера» использует отдельный ключ
`levelup-arena:levi-tour-dev-role-slice` в localStorage текущего origin. Только
«Готово» и «Пропустить экскурсию» записывают временную отметку, совместимую с первым
срезом. Выбор роли, реакция и шаги Home ничего не записывают. После закрытия/пропуска
обновите страницу: автоматический показ среза больше не происходит. «Повторить экскурсию» работает
без удаления отметок. Старый `levelup-arena:onboarding-complete` и полный
`levelup-arena:levi-tour-version` не участвуют в проверке этого dev-среза.
Существующий полный ключ, включая преждевременно записанное `1`, не изменяется и
не удаляется. Решение о миграции этого тестового значения нужно принять перед
подключением полной экскурсии к production; текущий dev-срез не подтверждает её
прохождение. localStorage зависит от
порта: данные на 5180/5181 не совпадают с данными основного приложения на 5173.

«Проверить существующего пользователя» создаёт изолированные данные в памяти:
старый onboarding пройден, выбрана Sales Manager, 120 XP (Level 2), Energy 3/6,
Streak 5. Открывается Home с объяснением Level/XP без повторного выбора роли и без
выдуманного события реакции. «Повторить экскурсию» также начинает с Home, если роль
уже выбрана. Проверяйте сохранение роли и значений после пропуска, финала и повтора.
Повторное нажатие режима создаёт свежий тестовый снимок без изменения данных браузера.

LeviTour не подключён к App или старому OnboardingPage и не входит в production bundle.
Подсветка карточек начинается только со второй реплики, после таймера или «Дальше».
Она использует data-tour атрибуты и одновременно выделяет все три роли до выбора
или пропуска. Циклического таймера больше нет; hover/focus не снимают выделение.
Выбор роли, пропуск и размонтирование очищают подсветку. Это только
оформление: клики и aria-pressed не изменяются. На Role Selection Леви находится в потоке страницы;
на мобильном служебные dev-панели находятся ниже настоящего экрана. Подсказка Home
размещается отдельным абсолютным слоем через portal вне карточек, ниже реальной цели
(для Arena — ниже её карточки). Она не меняет размеры карточек и не создаёт модальный overlay.
На мобильном кот уменьшен до 56 px. Объяснение и курсивный комментарий заданы отдельными
полями explanation / leviComment, без разбиения по предложениям. Подсветка Home — синий
контур 3 px, мягкое свечение и однократный импульс 650 мс; reduced-motion убирает импульс.
Прокрутка рассчитывается из
реальных границ элементов и минимально сдвигает страницу; если места мало, приоритет
у реальной кнопки. Отсутствующая цель не блокирует «Дальше».
Проверять 320/375/390 px с высотой 740 px и 1440 px с высотой 900 px: подсвеченные
элементы и кнопки должны оставаться видимыми и кликабельными. Системное уменьшение движения отключает анимации
Mascot, смены текста и импульс подсветки (остаётся статичное выделение).
