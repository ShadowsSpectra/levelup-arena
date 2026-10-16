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
