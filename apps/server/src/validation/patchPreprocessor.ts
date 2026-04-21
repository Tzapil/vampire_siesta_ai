import { issue, type ValidationIssue } from "./contracts";
import { isPatchAllowed } from "./rules/wizardRules";

export type Patch = {
  characterUuid: string;
  baseVersion: number;
  op: "set";
  path: string;
  value: unknown;
};

export type TraitPatchDescriptor = {
  group: "attributes" | "abilities" | "disciplines" | "backgrounds" | "virtues";
  key: string;
  layerName: "base" | "freebie" | "storyteller";
};

export type PatchPreprocessResult =
  | { ok: true; patch: Patch; traitPatch?: TraitPatchDescriptor }
  | { ok: false; issues: ValidationIssue[] };

const TRAIT_PATH = /^traits\.(attributes|abilities|disciplines|backgrounds|virtues)\.([^.]+)\.(base|freebie|storyteller)$/;

export function parseTraitPatchPath(path: string): TraitPatchDescriptor | undefined {
  const match = path.match(TRAIT_PATH);
  if (!match) {
    return undefined;
  }

  const [, group, key, layerName] = match;
  return {
    group: group as TraitPatchDescriptor["group"],
    key,
    layerName: layerName as TraitPatchDescriptor["layerName"]
  };
}

export function preprocessPatch(input: unknown, creationFinished: boolean): PatchPreprocessResult {
  if (!input || typeof input !== "object") {
    return { ok: false, issues: [issue("patch.format.invalid", "patch", "Неверный формат патча")] };
  }

  const patch = input as Patch;
  if (patch.op !== "set") {
    return { ok: false, issues: [issue("patch.op.invalid", "patch.op", "Неверный формат патча")] };
  }
  if (!patch.characterUuid || typeof patch.characterUuid !== "string") {
    return { ok: false, issues: [issue("patch.character_uuid.required", "patch.characterUuid", "Не указан персонаж")] };
  }
  if (!patch.path || typeof patch.path !== "string") {
    return { ok: false, issues: [issue("patch.path.required", "patch.path", "Не указан путь")] };
  }
  if (!isPatchAllowed(patch.path, creationFinished)) {
    return { ok: false, issues: [issue("patch.path.disallowed", patch.path, "Недопустимый путь для изменения")] };
  }

  return {
    ok: true,
    patch,
    traitPatch: parseTraitPatchPath(patch.path)
  };
}
