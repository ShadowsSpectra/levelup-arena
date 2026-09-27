# AI boundary

The browser calls only the application-owned `/api/ai` route. Vite serves this route in both `dev` and `preview`. It is a local hackathon implementation, not an authenticated public API.

`AIProvider` represents model access only. `createOpenAICompatibleProvider` is the first implementation.

Full Arena cards and their validation are owned by `server/content/arenaSources.ts` and the JSON files beside it. The browser loads only the explicit public projection from `GET /api/ai/arena-content`; full cards are not imported into the client bundle. Both `POST /api/ai/opponent` and `POST /api/ai/evaluate` accept `{ characterId, scenarioId, playerRole, session: { id, currentTurn, status, messages: [{ id, speaker, text }] }, ai?: { provider, baseUrl, apiKey, model } }`. Opponent requires `responding`, Evaluator requires `completed`. `arenaRequest.ts` resolves authoritative cards and validates IDs, their pairing and player role, turn limits, message fields, unique IDs and alternating transcript structure. Extra fields (including full cards, hidden context and provider roles) are rejected before any AI request. The original transcript text is preserved exactly. The separately validated optional `ai` configuration never enters prompts. This validates request structure, not transcript provenance or user authorization; authentication and server-owned session persistence remain outside this stage.

`createAIOpponentService` owns negotiation roleplay and builds its own Character/Scenario prompt. `createAIEvaluatorService` independently evaluates a completed transcript, requests structured JSON and validates it before the Result UI can use it. Both resolve their own task model through `resolveAIModel`, so Opponent and Evaluator can use different provider/model configurations without sharing business logic.

## Default AI and per-tab BYOK (deployment Stage 3)

`runtimeAISettings.ts` snapshots and validates server environment defaults at middleware creation:

```text
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.mistral.ai/v1
AI_API_KEY=<secret set outside git>
AI_MODEL=<tested provider model ID>
```

All four variables must be supplied together; incomplete/invalid defaults fail configuration validation. If none are supplied, BYOK can still work, but default requests return 409. Vite dev/preview loads `AI_` variables from ignored environment files/process environment into middleware closures only. Never use `VITE_` for credentials or add them to `define`. No environment secret is bundled into the client. Preview always enforces production URL policy; only explicit development runtime permits localhost HTTP/HTTPS (localhost, 127.0.0.1, ::1).

Production uses exact HTTPS API-root allowlisting: `https://api.mistral.ai/v1`, `https://api.openai.com/v1`, `https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1`. Optional `AI_BYOK_ALLOWED_BASE_URLS` is a comma-separated replacement list of trusted API roots, not wildcards. It applies to both defaults and BYOK, so include the configured default root. Production forbids localhost/IP roots, URL credentials, queries and fragments. Unknown hosts, ports and extra paths are rejected. Redirects remain disabled. Only administrators should extend the list to vetted public providers; do not allow user-controlled/private endpoints. No generic proxy or provider-specific SDK is introduced.

`GET /api/ai/settings` returns only default metadata (configured/provider/baseUrl/model), never a key. Configured means credentials exist, not guaranteed provider availability. `POST /api/ai/settings` returns 405: there is no server-wide mutation endpoint. The AI Settings dialog saves a successfully tested user configuration solely in tab JavaScript memory (`aiSettingsSession.ts`). Closing/reopening the dialog or switching roles preserves it; refreshing/closing the tab forgets it. Blank replacement-key input reuses only that tab's own key. Default metadata never provides a reusable key. “Использовать AI приложения” clears BYOK explicitly.

Both Arena gateways include complete BYOK as optional `ai` in each HTTPS request. The server creates a request-local provider with that key/model/endpoint. No override means the immutable server default; present but invalid/incomplete override is an error, never partial merging or default-key reuse. Failures/timeouts return existing retryable errors without switching provider or Mock. `POST /api/ai/check` accepts `{}` for defaults or `{ ai: ... }` for BYOK, tests a neutral message and never saves/changes configuration. `GET /api/ai/models-check` uses defaults; `POST` with the same check envelope uses BYOK for that diagnostic request only. Response serialization redacts the default and current-request key defensively; logs must never capture request bodies, prompts, transcripts or Authorization.

BYOK security tradeoff: the user's own key exists in password input/tab memory, our HTTPS request, request-local server memory and the upstream Authorization header. It is never placed in localStorage, sessionStorage, cookies, URLs or returned settings. Memory-only storage is not protection against XSS/extensions/DevTools, and JavaScript cannot guarantee secure erasure. Users must trust our server and selected provider. The BYOK provider receives full private Arena prompts; server-owned content means not shipped to the browser, not hidden from that provider.

`AIConfig.models` still permits future separate Opponent/Evaluator configurations. Prompts, evaluation, progression and retry behavior are unchanged. Mock remains explicit test/development infrastructure only. Stage 4 still needs a production entry/static hosting, HTTPS and production secrets. An anonymous demo also needs provider budget controls and hosting/request limits; origin checks are not authentication. No accounts, persistent backend, Railway or production Node entry is implemented here. Do not publish the Vite dev server.
