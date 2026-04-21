# Character Validation Architecture (Feature 01)

## Module Boundaries

- `service.ts`: `CharacterValidationService` orchestrates validation pipelines, records metrics, and exposes transport-agnostic methods.
- `dictionaryProvider.ts`: `DictionaryProvider` abstraction with Mongo-backed loader and TTL cache.
- `rules/baseRules.ts`: shared structural and range validation.
- `rules/clanRules.ts`: clan-specific domain adjustments.
- `rules/generationRules.ts`: generation-derived constraints and calculations.
- `rules/wizardRules.ts`: wizard step rules, freebie budget math, patch path policy.
- `patchPreprocessor.ts`: patch normalization and fail-fast malformed payload checks.
- `pipeline.ts`: reusable staged execution pipeline with fail-fast/collect-all control.
- `valueObjects.ts`: lightweight domain value objects (`TraitValue`, `ResourceBounds`, `GenerationConstraint`).
- `characterValidation.ts`: compatibility adapter + feature-flag switch + side-by-side parity logging.
- `legacyCharacterValidation.ts`: isolated legacy implementation for rollback window.

## Shared Contracts

- `ValidationContext`: character + dictionaries + validation mode options.
- `ValidationIssue`: `{ code, path, message, severity }`.
- `ValidationResult`: `{ issues, durationMs }`.
- `ValidationError` compatibility shape for existing HTTP/socket consumers.

## Folder Structure

- `apps/server/src/validation/contracts.ts`
- `apps/server/src/validation/dictionaryProvider.ts`
- `apps/server/src/validation/layered.ts`
- `apps/server/src/validation/valueObjects.ts`
- `apps/server/src/validation/patchPreprocessor.ts`
- `apps/server/src/validation/pipeline.ts`
- `apps/server/src/validation/service.ts`
- `apps/server/src/validation/rules/baseRules.ts`
- `apps/server/src/validation/rules/clanRules.ts`
- `apps/server/src/validation/rules/generationRules.ts`
- `apps/server/src/validation/rules/wizardRules.ts`
- `apps/server/src/validation/characterValidation.ts`
- `apps/server/src/validation/legacyCharacterValidation.ts`
