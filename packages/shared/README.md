# `@siesta/shared`

Workspace package for pure modules that can be consumed by both `apps/client` and `apps/server`.

Rules:

- No React, Express, Mongoose, browser APIs, `window`, `document`, `Socket`, or Node-only side effects.
- Keep modules deterministic and serializable where practical.
- Export shared contracts and pure helpers from here before duplicating logic across app boundaries.
