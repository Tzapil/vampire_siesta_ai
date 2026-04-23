# Character Validation Baseline

## Responsibility Map (`characterValidation.ts`)

### Data access and caching
- `loadDictionaries` loads all dictionary collections and keeps an in-memory cache with `DICT_TTL_MS`.
- `validateStep1` performs DB existence check for `meta.chronicleId` via `ChronicleModel.exists`.

### Patch/domain mutation helpers
- Layer access/mutation: `getLayer`, `setLayer`, `sumLayered`, `sumFreebieDots`.
- Domain recalculation: `applyClanRules`, `applyGenerationDerived`, `recalcFlawFreebie`, `rollbackFreebies`.

### Business rules
- Structural/domain ranges: `validateRanges`.
- Wizard rules: `validateStep1` ... `validateStep8`, `validateWizardStep`, `validateAllWizardSteps`.
- Freebie math: `computeFlawFreebie`, `computeFreebieSpent`, `computeFreebieBudget`, `computeRemainingFreebies`.

### Patch policy and step mapping
- `getStepForPath` maps patch path to wizard step.
- `isPatchAllowed` validates writable paths for wizard/game modes.

### Error mapping
- `ValidationError` shape (`{ path, message }`).
- Rule functions produce `ValidationError[]` with user-facing messages and patch paths.

## Call Sites

### HTTP routes
- `apps/server/src/routes/characters.ts`
- `apps/server/src/routes/chronicles.ts`
- Used in:
  - `POST /chronicles/:id/characters/import` -> `validateAllWizardSteps`
  - `POST /characters/:uuid/wizard/next` -> `validateWizardStep`
  - `POST /characters/:uuid/wizard/finish` -> `validateAllWizardSteps`
  - `POST /characters/:uuid/wizard/finish` -> `computeRemainingFreebies`, `getLayer`
  - Several creation constants and dictionary loader usages.

### Socket flow
- `apps/server/src/socket.ts`
- Used in patch handling:
  - policy: `isPatchAllowed`, `getStepForPath`
  - dictionary and derived logic: `loadDictionaries`, `applyClanRules`, `applyGenerationDerived`
  - freebie logic: `recalcFlawFreebie`, `computeFreebieBudget`, `computeFreebieSpent`, `rollbackFreebies`
  - range validation: `validateRanges`
  - layer helper: `getLayer`, `setLayer`

## Baseline Critical Flows to Keep Stable
- Wizard step validation (1-8) returns same path/message semantics.
- Socket patch rejects unsupported paths and invalid trait layer updates.
- Clan/generation changes trigger derived adjustments.
- Freebie overspend handling: reject or rollback path remains unchanged.
- Range validation enforces health/resource bounds and clan discipline restrictions.
