# Streamient mobile client

The mobile app uses React, TypeScript, Vite, and Capacitor. Run `pnpm --filter @streamient/mobile exec tsc --noEmit` from the repository root to check types.

## Feed and reconnect behavior

Every initial feed load requests a fresh first page. This also replaces stale rows left by older clients that missed project moves. Reconnect catch-up requests tenant-wide changes on every page. The client removes records moved out of the selected project and applies the current type filter. Server tenant and email access checks still apply.

Pending feed pages and catch-up requests track intervening live changes. An older response cannot restore a deleted row or replace an updated row. Initial live events wait for the first-page snapshot.

## Search and AI chat

Only the newest search can set results, errors, or loading state. Changing the project, query, filter, server, or session invalidates pending searches.

New chat and history selection are disabled while an answer streams, including history rows already open. A history request started before a new answer cannot replace that answer.

## Document imports

Uploads use integrity-checked chunks of at most 4 MB. Resume uses the server-confirmed offset. Terminal imports retry removal of app-owned shared copies. If cleanup fails, the registry entry and tray retry control remain available, and other uploads still restore. Cleanup retry does not send another cancel request for completed or canceled imports.

## Regression checks

Run `pnpm exec node --test test/mobile-client-regressions.test.js test/mobile-upload-controls.test.js test/mobile-app-source.test.js`. These checks use deferred requests and mocked native file removal. Browser and native device checks remain separate.
