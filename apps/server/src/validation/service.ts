import { performance } from "node:perf_hooks";
import { ChronicleModel } from "../db";
import type { ChronicleExistsFn, ValidationIssue, ValidationResult } from "./contracts";
import { issue } from "./contracts";
import {
  getDefaultDictionaryProvider,
  type Dictionaries,
  type DictionaryProvider
} from "./dictionaryProvider";
import { validationMetrics } from "./metrics";
import { preprocessPatch, type Patch, type TraitPatchDescriptor } from "./patchPreprocessor";
import { runValidationPipeline } from "./pipeline";
import { validateRanges } from "./rules/baseRules";
import { applyClanRules } from "./rules/clanRules";
import { applyGenerationDerived } from "./rules/generationRules";
import {
  computeFlawFreebie,
  computeFreebieBudget,
  computeFreebieSpent,
  computeRemainingFreebies,
  getStepForPath,
  recalcFlawFreebie,
  rollbackFreebies,
  validateAllWizardSteps,
  validateFreebieBuyPatch,
  validatePriorityPatch,
  validateTraitValueForPatch,
  validateWizardStep,
  WIZARD_STEPS
} from "./rules/wizardRules";

type PatchValidationInput = {
  patch: unknown;
  character: any;
  dictionaries: Dictionaries;
  chronicleExists?: ChronicleExistsFn;
};

type PatchPipelineState = {
  failFast: boolean;
  issues: ValidationIssue[];
  patch?: Patch;
  traitPatch?: TraitPatchDescriptor;
};

type ValidationOptions = {
  mutate?: boolean;
  chronicleExists?: ChronicleExistsFn;
};

export class CharacterValidationService {
  constructor(private readonly dictionaryProvider: DictionaryProvider = getDefaultDictionaryProvider()) {}

  async loadDictionaries(): Promise<Dictionaries> {
    const before = this.dictionaryProvider.getCacheStats();
    const dictionaries = await this.dictionaryProvider.getDictionaries();
    const after = this.dictionaryProvider.getCacheStats();
    validationMetrics.recordDictionaryCache(after.hits > before.hits);
    return dictionaries;
  }

  invalidateDictionaryCache() {
    this.dictionaryProvider.invalidateCache();
  }

  getDictionaryCacheStats() {
    return this.dictionaryProvider.getCacheStats();
  }

  async validateWizardStep(character: any, step: number, dict: Dictionaries, options: ValidationOptions = {}) {
    const startedAt = performance.now();
    const issues = await validateWizardStep(character, step, dict, options);
    const durationMs = performance.now() - startedAt;
    validationMetrics.recordValidation(durationMs, issues);
    return this.toResult(issues, durationMs);
  }

  async validateAllWizardSteps(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
    const startedAt = performance.now();
    const issues = await validateAllWizardSteps(character, dict, options);
    const durationMs = performance.now() - startedAt;
    validationMetrics.recordValidation(durationMs, issues);
    return this.toResult(issues, durationMs);
  }

  validateRanges(character: any, dict: Dictionaries, allowNonClanDisciplines = false) {
    const startedAt = performance.now();
    const issues = validateRanges(character, dict, { allowNonClanDisciplines });
    const durationMs = performance.now() - startedAt;
    validationMetrics.recordValidation(durationMs, issues);
    return this.toResult(issues, durationMs);
  }

  async validatePatchStructure(input: PatchValidationInput) {
    const startedAt = performance.now();

    const pipelineResult = await runValidationPipeline<PatchPipelineState>(
      { failFast: true, issues: [] },
      [
        {
          name: "preprocess_patch",
          run: (state) => {
            const result = preprocessPatch(input.patch, input.character.creationFinished);
            if (!result.ok) {
              return { ...state, issues: result.issues };
            }
            return { ...state, patch: result.patch, traitPatch: result.traitPatch };
          }
        },
        {
          name: "build_context",
          run: (state) => state
        },
        {
          name: "structural_rules",
          run: async (state) => {
            if (!state.patch) {
              return state;
            }

            const structuralIssues: ValidationIssue[] = [];
            const patch = state.patch;
            const traitPatch = state.traitPatch;

            if (traitPatch) {
              const exists = this.hasTraitKey(input.dictionaries, traitPatch.group, traitPatch.key);
              if (!exists) {
                structuralIssues.push(issue("patch.dictionary_key.unknown", patch.path, "Неизвестный ключ справочника"));
              } else {
                structuralIssues.push(
                  ...validateTraitValueForPatch(
                    traitPatch.group,
                    traitPatch.key,
                    traitPatch.layerName,
                    patch.value,
                    input.character,
                    input.dictionaries
                  )
                );
              }
            }

            structuralIssues.push(...validatePriorityPatch(patch.path, patch.value));
            structuralIssues.push(...validateFreebieBuyPatch(patch.path, patch.value));
            structuralIssues.push(...this.validatePatchMeta(patch, input.dictionaries));
            structuralIssues.push(...this.validatePatchMeritsFlaws(patch));

            if (patch.path.startsWith("meta.chronicleId") && input.chronicleExists) {
              const exists = await input.chronicleExists(patch.value);
              if (!exists) {
                structuralIssues.push(issue("patch.meta.chronicle.not_found", patch.path, "Хроника не найдена"));
              }
            }

            return { ...state, issues: structuralIssues, failFast: false };
          }
        },
        {
          name: "domain_rules",
          run: (state) => state
        },
        {
          name: "normalize_issues",
          run: (state) => state
        }
      ]
    );

    const durationMs = performance.now() - startedAt;
    validationMetrics.recordValidation(durationMs, pipelineResult.state.issues);
    return {
      ...this.toResult(pipelineResult.state.issues, durationMs),
      patch: pipelineResult.state.patch,
      traitPatch: pipelineResult.state.traitPatch
    };
  }

  getMetricsSnapshot() {
    return validationMetrics.snapshot();
  }

  getStepForPath(path: string, currentStep?: number) {
    return getStepForPath(path, currentStep);
  }

  recalcFlawFreebie(character: any, dict: Dictionaries) {
    return recalcFlawFreebie(character, dict);
  }

  computeFlawFreebie(character: any, dict: Dictionaries) {
    return computeFlawFreebie(character, dict);
  }

  computeFreebieBudget(character: any, dict: Dictionaries) {
    return computeFreebieBudget(character, dict);
  }

  computeFreebieSpent(character: any, dict: Dictionaries) {
    return computeFreebieSpent(character, dict);
  }

  computeRemainingFreebies(character: any, dict: Dictionaries) {
    return computeRemainingFreebies(character, dict);
  }

  applyClanRules(character: any, dict: Dictionaries, mode: "wizard" | "st") {
    return applyClanRules(character, dict, mode);
  }

  applyGenerationDerived(character: any, dict: Dictionaries) {
    return applyGenerationDerived(character, dict);
  }

  rollbackFreebies(character: any, dict: Dictionaries) {
    return rollbackFreebies(character, dict);
  }

  getWizardStepsCount() {
    return WIZARD_STEPS;
  }

  defaultChronicleExists: ChronicleExistsFn = async (chronicleId: unknown) => {
    const exists = await ChronicleModel.exists({ _id: chronicleId });
    return Boolean(exists);
  };

  private hasTraitKey(dict: Dictionaries, group: TraitPatchDescriptor["group"], key: string) {
    if (group === "attributes") {
      return dict.attributes.some((item) => item.key === key);
    }
    if (group === "abilities") {
      return dict.abilities.some((item) => item.key === key);
    }
    if (group === "disciplines") {
      return dict.disciplines.some((item) => item.key === key);
    }
    if (group === "backgrounds") {
      return dict.backgrounds.some((item) => item.key === key);
    }
    return dict.virtues.some((item) => item.key === key);
  }

  private validatePatchMeta(patch: Patch, dict: Dictionaries): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (patch.path.startsWith("meta.sectKey")) {
      if (typeof patch.value !== "string" || !dict.sects.has(patch.value)) {
        issues.push(issue("patch.meta.sect.invalid", patch.path, "Недопустимая секта"));
      }
    }
    if (patch.path.startsWith("meta.natureKey")) {
      if (typeof patch.value !== "string" || !dict.natures.has(patch.value)) {
        issues.push(issue("patch.meta.nature.invalid", patch.path, "Недопустимая натура"));
      }
    }
    if (patch.path.startsWith("meta.demeanorKey")) {
      if (typeof patch.value !== "string" || !dict.demeanors.has(patch.value)) {
        issues.push(issue("patch.meta.demeanor.invalid", patch.path, "Недопустимое поведение"));
      }
    }

    return issues;
  }

  private validatePatchMeritsFlaws(patch: Patch): ValidationIssue[] {
    if (patch.path !== "traits.merits" && patch.path !== "traits.flaws") {
      return [];
    }
    if (!Array.isArray(patch.value) || patch.value.some((item) => typeof item !== "string")) {
      return [issue("patch.list.invalid", patch.path, "Неверный формат списка")];
    }
    return [];
  }

  private toResult(issues: ValidationIssue[], durationMs: number): ValidationResult {
    return {
      issues,
      durationMs
    };
  }
}

export const characterValidationService = new CharacterValidationService();
