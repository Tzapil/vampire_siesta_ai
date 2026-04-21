import type { Dictionaries } from "../dictionaryProvider";
import { GenerationConstraint } from "../valueObjects";

export function applyGenerationDerived(character: any, dict: Dictionaries) {
  const generation = Number(character.meta?.generation ?? 0);
  const record = dict.generations.get(generation);
  if (!record) {
    return false;
  }

  const constraint = new GenerationConstraint(record);
  const current = character.derived ?? {};
  const next = {
    ...current,
    bloodPoolMax: constraint.bloodPoolMax,
    bloodPerTurn: constraint.bloodPerTurn
  };

  if (current.bloodPoolMax !== next.bloodPoolMax || current.bloodPerTurn !== next.bloodPerTurn) {
    character.derived = next;
    return true;
  }

  return false;
}
