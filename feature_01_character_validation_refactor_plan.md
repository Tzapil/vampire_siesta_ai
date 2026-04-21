# Feature 01: Character Validation Refactor Plan

## Problem Statement

Current character validation is concentrated in `apps/server/src/validation/characterValidation.ts` and mixes:
- data access (`loadDictionaries` and model queries),
- patch processing and mutation helpers,
- business rule evaluation (clan, generation, wizard steps).

This coupling increases bug risk, slows feature delivery, and makes testing expensive.

## Goal

Build a modular validation architecture with clear boundaries:
- data loading and caching,
- domain rule evaluation,
- transport-agnostic validation orchestration.

## Non-Goals (for this feature)

- Full data model redesign across the whole project.
- Introducing a third-party rules engine in phase 1.
- Changing client payload format.

## Step-by-Step Plan

### Step 1. Baseline and Safety Net

1. Catalog current validation responsibilities inside `characterValidation.ts`:
- patch normalization,
- dictionary loading,
- rule checks (clan, generation, wizard),
- error mapping.
2. Map all call sites in server code (routes + socket handlers).
3. Add characterization tests around current behavior to freeze expected outputs before refactor.

Done criteria:
- Responsibility map documented.
- Existing behavior covered by baseline tests for critical flows.

### Step 2. Target Module Design

1. Define module boundaries:
- `CharacterValidationService` (orchestrator),
- `DictionaryProvider` (read model + cache),
- rule modules (`baseRules`, `clanRules`, `generationRules`, `wizardRules`),
- `PatchPreprocessor`.
2. Define shared contracts:
- `ValidationContext`,
- `ValidationIssue` (code, path, message, severity),
- `ValidationResult`.

Done criteria:
- Interfaces and folder structure agreed and committed.

### Step 3. Extract Data Access from Validation Rules

1. Move dictionary/model queries out of rule functions into `DictionaryProvider`.
2. Inject provider into validation service (dependency injection, no direct model imports in rules).
3. Add in-memory cache for dictionaries with explicit invalidation strategy (TTL or event-based hook).

Done criteria:
- Rule modules run without DB calls.
- Dictionary loading path is centralized and cached.

### Step 4. Split Monolith into Composable Rule Modules

1. Move each rule family into separate files with single responsibility.
2. Keep rule modules pure where possible (input context -> issues).
3. Preserve parity with old behavior using baseline tests from Step 1.

Done criteria:
- No new rule logic remains in the old monolithic file.
- Rule modules are independently unit-testable.

### Step 5. Implement Validation Pipeline

1. Add pipeline stages:
- preprocess patch,
- build validation context,
- run structural rules,
- run domain rules,
- aggregate and normalize issues.
2. Decide execution strategy per stage:
- fail-fast for malformed payloads,
- collect-all for business rule errors.
3. Return stable error codes for API/socket consumers.

Done criteria:
- Validation flow is explicit and deterministic.
- Error format is consistent across route and socket usage.

### Step 6. Introduce Minimal Domain Value Objects

1. Add lightweight value objects for frequently reused concepts:
- trait values,
- resource bounds,
- generation constraints.
2. Use these objects inside rules to remove repeated ad-hoc checks.

Done criteria:
- Key rule math/constraints no longer depend on raw untyped object traversal.

### Step 7. Integration and Incremental Rollout

1. Add compatibility adapter so existing callers use the new service without API changes.
2. Switch route and socket handlers to new orchestrator behind a feature flag.
3. Run side-by-side validation in staging (old vs new) and log mismatches.
4. Remove old path after parity window.

Done criteria:
- New validator serves all callers.
- Old monolithic path removed or isolated for deletion.

### Step 8. Test Strategy and Quality Gates

1. Unit tests:
- each rule module,
- patch preprocessing,
- dictionary cache behavior.
2. Integration tests:
- character update route validation,
- socket patch validation flow.
3. Regression suite:
- clan/generation/wizard edge cases,
- malformed patch payloads.

Done criteria:
- Test coverage for validation domain materially improved.
- CI includes validation-focused suite.

### Step 9. Performance and Operability Checks

1. Add metrics/log points:
- validation duration,
- dictionary cache hit/miss,
- validation rejection reasons by code.
2. Compare before/after performance on representative patch workloads.
3. Define rollback path (feature flag off) if mismatch/error rate spikes.

Done criteria:
- Refactor is measurable, reversible, and production-safe.

## Suggested Delivery Slices

1. Slice A: Steps 1-3 (foundation + data decoupling).
2. Slice B: Steps 4-5 (modular rules + pipeline).
3. Slice C: Steps 6-9 (domain objects, rollout, metrics, hardening).

## Risks and Mitigations

- Risk: Behavior drift during rule extraction.
Mitigation: characterization tests + side-by-side staging compare.

- Risk: Cache staleness for dictionary updates.
Mitigation: short TTL first, explicit invalidation endpoint/event later.

- Risk: Integration breakage in socket path.
Mitigation: shared service for route and socket + integration tests for both transports.

## Definition of Done (Feature 01)

- Validation no longer performs direct DB queries from rule modules.
- Monolithic logic is split into composable modules with clear contracts.
- Routes and sockets consume one unified validation service.
- Baseline parity achieved and validated by tests.
- Performance regression is not introduced, and cache effectiveness is visible in metrics.
