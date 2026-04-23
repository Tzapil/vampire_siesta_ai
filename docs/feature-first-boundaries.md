# Feature-First Boundaries

This document fixes the import boundaries introduced by Feature 06 foundation work.

## Client

- `app` composes routes, providers, shell, and may import from `features` and `shared`.
- `features` contain screen/use-case logic and may import from `shared` and `@siesta/shared`.
- `shared` contains low-level UI, generic hooks, and pure helpers.
- Route entry points in `pages` stay thin during migration and should move orchestration into `features`.
- Do not import server code into the client.
- Do not bypass a feature's public API to reach its internals from another feature.

## Server

- `app` wires HTTP/socket bootstrap and may import from `features`, `shared`, `infra`, and `validation`.
- `features` contain use-case and screen-oriented application logic and may import from `shared`, `infra`, `validation`, and `@siesta/shared`.
- `shared` contains cross-feature helpers only.
- `infra` contains low-level adapters such as db/auth/socket plumbing and must stay free of UI-shaped contracts.
- Do not import client code into the server.
- Do not introduce cross-feature imports that bypass an explicit public API.

## Shared Workspace Package

- `packages/shared` is reserved for pure modules needed by both apps.
- No framework, browser, database, or transport-specific dependencies are allowed there.
