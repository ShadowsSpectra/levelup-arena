# Future AI boundary

The Arena browser currently uses `mockOpponentService`. No AI endpoint or external API call is active.

`AIProvider` represents model access only. `createAIOpponentService` adapts model output to the existing `OpponentService` contract; its future `createMessages` callback owns roleplay instructions. An Evaluator service can independently use `resolveAIModel('evaluator', ...)` and the same provider interface without sharing opponent logic.

When adding a real provider, implement it in this server/serverless layer and register it by ID. Keep provider keys and any future user-supplied keys in server-side secret storage. The browser should call only the application-owned `serverEndpoint`, never the upstream `apiEndpoint` directly. `AIConfig.models` can select different provider/model pairs for opponent and evaluator. Neither URL nor model config contains credentials.
