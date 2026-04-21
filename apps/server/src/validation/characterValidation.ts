import * as legacy from "./legacyCharacterValidation";
import type { ChronicleExistsFn, ValidationError } from "./contracts";
import { toValidationErrors } from "./contracts";
import {
  getDictionaryCacheStats,
  invalidateDictionaryCache,
  type Dictionaries
} from "./dictionaryProvider";
import { getLayer, setLayer, sumFreebieDots } from "./layered";
import { validationMetrics } from "./metrics";
import { isPatchAllowed as isPatchAllowedV2 } from "./rules/wizardRules";
import {
  ABIL_BUDGET,
  ATTR_BUDGET,
  BASE_BACKGROUNDS_POINTS,
  BASE_DISCIPLINES_POINTS,
  BASE_VIRTUES_EXTRA,
  computeFlawFreebie as computeFlawFreebieV2,
  computeFreebieBudget as computeFreebieBudgetV2,
  computeFreebieSpent as computeFreebieSpentV2,
  computeRemainingFreebies as computeRemainingFreebiesV2,
  FREEBIE_BASE,
  FREEBIE_COST,
  FLAW_FREEBIE_CAP,
  getStepForPath as getStepForPathV2,
  recalcFlawFreebie as recalcFlawFreebieV2,
  rollbackFreebies as rollbackFreebiesV2,
  validateStep1 as validateStep1V2,
  validateStep2 as validateStep2V2,
  validateStep3 as validateStep3V2,
  validateStep4 as validateStep4V2,
  validateStep5 as validateStep5V2,
  validateStep6 as validateStep6V2,
  validateStep7 as validateStep7V2,
  validateStep8 as validateStep8V2,
  WIZARD_STEPS
} from "./rules/wizardRules";
import { applyClanRules as applyClanRulesV2 } from "./rules/clanRules";
import { applyGenerationDerived as applyGenerationDerivedV2 } from "./rules/generationRules";
import { characterValidationService } from "./service";

export type { Dictionaries, ValidationError };
export type ValidationOptions = { mutate?: boolean; chronicleExists?: ChronicleExistsFn };

function isTruthyEnv(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function isFalsyEnv(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "no";
}

function useV2ValidationEngine() {
  if (isFalsyEnv("VALIDATION_ENGINE_V2")) {
    return false;
  }
  return true;
}

function useSideBySideCompare() {
  return isTruthyEnv("VALIDATION_SIDE_BY_SIDE");
}

function normalizeErrors(errors: ValidationError[]) {
  return errors.map((item) => `${item.path}|${item.message}`).sort();
}

function reportMismatch(name: string, nextErrors: ValidationError[], legacyErrors: ValidationError[]) {
  if (!useSideBySideCompare()) {
    return;
  }

  const nextNormalized = normalizeErrors(nextErrors);
  const legacyNormalized = normalizeErrors(legacyErrors);

  if (JSON.stringify(nextNormalized) === JSON.stringify(legacyNormalized)) {
    return;
  }

  console.warn(
    `[validation-shadow] Mismatch in ${name}`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      next: nextNormalized,
      legacy: legacyNormalized
    })
  );
}

function resolveOptions(options: ValidationOptions | undefined): ValidationOptions {
  return {
    mutate: options?.mutate,
    chronicleExists: options?.chronicleExists ?? characterValidationService.defaultChronicleExists
  };
}

export async function loadDictionaries(): Promise<Dictionaries> {
  if (!useV2ValidationEngine()) {
    return legacy.loadDictionaries();
  }
  return characterValidationService.loadDictionaries();
}

export function validateRanges(
  character: any,
  dict: Dictionaries,
  options: { allowNonClanDisciplines?: boolean } = {}
): ValidationError[] {
  if (!useV2ValidationEngine()) {
    return legacy.validateRanges(character, dict, options);
  }

  const next = toValidationErrors(
    characterValidationService.validateRanges(character, dict, options.allowNonClanDisciplines === true).issues
  );
  if (useSideBySideCompare()) {
    const old = legacy.validateRanges(character, dict, options);
    reportMismatch("validateRanges", next, old);
  }
  return next;
}

export async function validateStep1(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep1(character, dict);
  }
  const resolved = resolveOptions(options);
  const next = toValidationErrors(await validateStep1V2(character, dict, resolved));
  if (useSideBySideCompare()) {
    const old = await legacy.validateStep1(character, dict);
    reportMismatch("validateStep1", next, old);
  }
  return next;
}

export function validateStep2(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep2(character, dict);
  }
  const next = toValidationErrors(validateStep2V2(character, dict));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep2(character, dict);
    reportMismatch("validateStep2", next, old);
  }
  return next;
}

export function validateStep3(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep3(character, dict);
  }
  const next = toValidationErrors(validateStep3V2(character, dict));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep3(character, dict);
    reportMismatch("validateStep3", next, old);
  }
  return next;
}

export function validateStep4(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep4(character, dict);
  }
  const next = toValidationErrors(validateStep4V2(character, dict));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep4(character, dict);
    reportMismatch("validateStep4", next, old);
  }
  return next;
}

export function validateStep5(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep5(character, dict);
  }
  const next = toValidationErrors(validateStep5V2(character, dict));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep5(character, dict);
    reportMismatch("validateStep5", next, old);
  }
  return next;
}

export function validateStep6(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep6(character, dict);
  }
  const next = toValidationErrors(validateStep6V2(character, dict));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep6(character, dict);
    reportMismatch("validateStep6", next, old);
  }
  return next;
}

export function validateStep7(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep7(character, dict, options);
  }
  const resolved = resolveOptions(options);
  const next = toValidationErrors(validateStep7V2(character, dict, resolved));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep7(character, dict, options);
    reportMismatch("validateStep7", next, old);
  }
  return next;
}

export function validateStep8(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
  if (!useV2ValidationEngine()) {
    return legacy.validateStep8(character, dict, options);
  }
  const resolved = resolveOptions(options);
  const next = toValidationErrors(validateStep8V2(character, dict, resolved));
  if (useSideBySideCompare()) {
    const old = legacy.validateStep8(character, dict, options);
    reportMismatch("validateStep8", next, old);
  }
  return next;
}

export async function validateWizardStep(
  character: any,
  step: number,
  dict: Dictionaries,
  options: ValidationOptions = {}
) {
  if (!useV2ValidationEngine()) {
    return legacy.validateWizardStep(character, step, dict, options);
  }

  const resolved = resolveOptions(options);
  const result = await characterValidationService.validateWizardStep(character, step, dict, resolved);
  const next = toValidationErrors(result.issues);
  if (useSideBySideCompare()) {
    const old = await legacy.validateWizardStep(character, step, dict, options);
    reportMismatch("validateWizardStep", next, old);
  }
  return next;
}

export async function validateAllWizardSteps(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
  if (!useV2ValidationEngine()) {
    return legacy.validateAllWizardSteps(character, dict, options);
  }

  const resolved = resolveOptions(options);
  const result = await characterValidationService.validateAllWizardSteps(character, dict, resolved);
  const next = toValidationErrors(result.issues);
  if (useSideBySideCompare()) {
    const old = await legacy.validateAllWizardSteps(character, dict, options);
    reportMismatch("validateAllWizardSteps", next, old);
  }
  return next;
}

export function applyClanRules(character: any, dict: Dictionaries, mode: "wizard" | "st") {
  if (!useV2ValidationEngine()) {
    return legacy.applyClanRules(character, dict, mode);
  }
  return applyClanRulesV2(character, dict, mode);
}

export function applyGenerationDerived(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.applyGenerationDerived(character, dict);
  }
  return applyGenerationDerivedV2(character, dict);
}

export function computeFlawFreebie(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.computeFlawFreebie(character, dict);
  }
  return computeFlawFreebieV2(character, dict);
}

export function recalcFlawFreebie(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.recalcFlawFreebie(character, dict);
  }
  return recalcFlawFreebieV2(character, dict);
}

export function computeFreebieBudget(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.computeFreebieBudget(character, dict);
  }
  return computeFreebieBudgetV2(character, dict);
}

export function computeFreebieSpent(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.computeFreebieSpent(character, dict);
  }
  return computeFreebieSpentV2(character, dict);
}

export function rollbackFreebies(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.rollbackFreebies(character, dict);
  }
  return rollbackFreebiesV2(character, dict);
}

export function computeRemainingFreebies(character: any, dict: Dictionaries) {
  if (!useV2ValidationEngine()) {
    return legacy.computeRemainingFreebies(character, dict);
  }
  return computeRemainingFreebiesV2(character, dict);
}

export function getStepForPath(path: string, currentStep?: number) {
  if (!useV2ValidationEngine()) {
    return legacy.getStepForPath(path, currentStep);
  }
  return getStepForPathV2(path, currentStep);
}

export function isPatchAllowed(path: string, creationFinished: boolean) {
  if (!useV2ValidationEngine()) {
    return legacy.isPatchAllowed(path, creationFinished);
  }
  return isPatchAllowedV2(path, creationFinished);
}

export {
  ABIL_BUDGET,
  ATTR_BUDGET,
  BASE_BACKGROUNDS_POINTS,
  BASE_DISCIPLINES_POINTS,
  BASE_VIRTUES_EXTRA,
  FREEBIE_BASE,
  FREEBIE_COST,
  FLAW_FREEBIE_CAP,
  getLayer,
  setLayer,
  sumFreebieDots,
  WIZARD_STEPS
};

export function invalidateValidationDictionaryCache() {
  if (!useV2ValidationEngine()) {
    return;
  }
  invalidateDictionaryCache();
}

export function getValidationMetricsSnapshot() {
  return validationMetrics.snapshot();
}

export function getValidationDictionaryCacheStats() {
  return getDictionaryCacheStats();
}
