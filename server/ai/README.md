# AI boundary

The browser calls only the application-owned `/api/ai` route. Vite serves this route in both `dev` and `preview`. It is a local hackathon implementation, not an authenticated public API.

`AIProvider` represents model access only. `createOpenAICompatibleProvider` is the first implementation.

`createAIOpponentService` owns negotiation roleplay and builds its own Character/Scenario prompt. `createAIEvaluatorService` independently evaluates a completed transcript, requests structured JSON and validates it before the Result UI can use it. Both resolve their own task model through `resolveAIModel`, so Opponent and Evaluator can use different provider/model configurations without sharing business logic.

AI Settings are kept only in the server process memory; `GET /api/ai/settings` returns metadata without the key. The browser never calls the upstream `apiEndpoint`. Failed provider requests return a Mock reply, so a demo remains usable. `AIConfig.models` can select different provider/model pairs for opponent and evaluator; neither URL nor model config contains credentials. A public deployment must replace this local route with an authenticated server/serverless endpoint and appropriate secret storage. Do not expose the local dev/preview server to untrusted users.
