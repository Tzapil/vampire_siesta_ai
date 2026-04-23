# Server Infra Layer

Infrastructure modules belong here: database adapters, session plumbing, socket plumbing, and other low-level integrations.

Rules:

- Keep infra free of UI-shaped screen contracts.
- Do not make infra depend on feature orchestration.
