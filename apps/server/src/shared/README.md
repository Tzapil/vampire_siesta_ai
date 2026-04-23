# Server Shared Layer

Place cross-feature helpers, presenters, and reusable mappers here.

Rules:

- No screen-specific orchestration.
- No direct dependency on client-only modules.
- Prefer `@siesta/shared` when the helper is pure and also useful on the client.
