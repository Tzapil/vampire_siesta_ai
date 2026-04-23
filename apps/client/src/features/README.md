# Client Features Layer

This directory hosts feature-first modules during the migration from the legacy flat structure.

Import rules:

- `app` may compose features.
- Features may depend on `shared` and `@siesta/shared`.
- Avoid direct cross-feature imports that bypass a feature's public surface.
