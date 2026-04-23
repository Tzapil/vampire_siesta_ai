# Server Features Layer

Feature modules should own screen/use-case-oriented application logic.

Import rules:

- `app` composes feature routers/services.
- Features may depend on `shared`, `infra`, `validation`, and `@siesta/shared`.
- Avoid implicit cross-feature coupling without a public API.
