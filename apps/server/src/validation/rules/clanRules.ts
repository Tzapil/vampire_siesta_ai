import type { Dictionaries } from "../dictionaryProvider";
import { getLayer, setLayer } from "../layered";
import { TraitValue } from "../valueObjects";

export function applyClanRules(character: any, dict: Dictionaries, mode: "wizard" | "st") {
  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  if (!clan) {
    return false;
  }

  let changed = false;
  const allowed = new Set<string>(clan.disciplineKeys ?? []);

  if (mode === "wizard") {
    for (const discipline of dict.disciplines) {
      if (!allowed.has(discipline.key)) {
        const current = getLayer(character.traits?.disciplines, discipline.key);
        if (new TraitValue(current).total !== 0) {
          setLayer(character.traits.disciplines, discipline.key, { base: 0, freebie: 0, storyteller: 0 });
          changed = true;
        }
      }
    }
  }

  const appearance = getLayer(character.traits?.attributes, "appearance");
  const appearanceTrait = new TraitValue(appearance);

  if (clan.rules?.appearanceFixedTo === 0) {
    if (mode === "wizard") {
      if (appearanceTrait.total !== 0 || appearance.base !== 0 || appearance.freebie !== 0 || appearance.storyteller !== 0) {
        setLayer(character.traits.attributes, "appearance", { base: 0, freebie: 0, storyteller: 0 });
        changed = true;
      }
    } else {
      const desiredStoryteller = 0 - (appearance.base + appearance.freebie);
      if (appearance.storyteller !== desiredStoryteller) {
        setLayer(character.traits.attributes, "appearance", {
          base: appearance.base,
          freebie: appearance.freebie,
          storyteller: desiredStoryteller
        });
        changed = true;
      }
    }
  } else if (mode === "wizard") {
    if (appearanceTrait.total === 0) {
      setLayer(character.traits.attributes, "appearance", { base: 1, freebie: 0, storyteller: 0 });
      changed = true;
    }
  } else if (appearanceTrait.total < 1) {
    const desiredStoryteller = 1 - (appearance.base + appearance.freebie);
    if (appearance.storyteller !== desiredStoryteller) {
      setLayer(character.traits.attributes, "appearance", {
        base: appearance.base,
        freebie: appearance.freebie,
        storyteller: desiredStoryteller
      });
      changed = true;
    }
  }

  return changed;
}
