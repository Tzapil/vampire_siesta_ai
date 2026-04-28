import type { AggregatedDictionariesDto, NpcDto, NpcInputDto } from "../api/types";

const EMPTY_HEALTH = { bashing: 0, lethal: 0, aggravated: 0 };

function buildTraitRecord(
  items: Array<{ key: string }>,
  defaultValue: number,
  values?: Record<string, number>
) {
  return Object.fromEntries(
    items.map((item) => [item.key, Number(values?.[item.key] ?? defaultValue)])
  );
}

export function createEmptyNpcInput(dictionaries: AggregatedDictionariesDto): NpcInputDto {
  return {
    meta: {
      name: "",
      avatarUrl: "",
      clanKey: "",
      sectKey: "",
      generation: null
    },
    traits: {
      attributes: buildTraitRecord(dictionaries.attributes, 1),
      abilities: buildTraitRecord(dictionaries.abilities, 0),
      disciplines: buildTraitRecord(dictionaries.disciplines, 0),
      virtues: buildTraitRecord(dictionaries.virtues, 1)
    },
    resources: {
      bloodPool: { current: 0 },
      willpower: { current: 0 },
      humanity: { current: 0 },
      health: { ...EMPTY_HEALTH }
    },
    notes: ""
  };
}

export function toNpcInput(npc: NpcDto, dictionaries: AggregatedDictionariesDto): NpcInputDto {
  return {
    meta: {
      name: npc.meta.name ?? "",
      avatarUrl: npc.meta.avatarUrl ?? "",
      clanKey: npc.meta.clanKey ?? "",
      sectKey: npc.meta.sectKey ?? "",
      generation: npc.meta.generation ?? null
    },
    traits: {
      attributes: buildTraitRecord(dictionaries.attributes, 1, npc.traits.attributes),
      abilities: buildTraitRecord(dictionaries.abilities, 0, npc.traits.abilities),
      disciplines: buildTraitRecord(dictionaries.disciplines, 0, npc.traits.disciplines),
      virtues: buildTraitRecord(dictionaries.virtues, 1, npc.traits.virtues)
    },
    resources: {
      bloodPool: { current: Number(npc.resources.bloodPool.current ?? 0) },
      willpower: { current: Number(npc.resources.willpower.current ?? 0) },
      humanity: { current: Number(npc.resources.humanity.current ?? 0) },
      health: {
        bashing: Number(npc.resources.health.bashing ?? 0),
        lethal: Number(npc.resources.health.lethal ?? 0),
        aggravated: Number(npc.resources.health.aggravated ?? 0)
      }
    },
    notes: npc.notes ?? ""
  };
}

export function clampNpcHealth(health: {
  bashing: number;
  lethal: number;
  aggravated: number;
}) {
  const bashing = Math.max(0, Math.min(7, Math.trunc(health.bashing)));
  const lethal = Math.max(0, Math.min(7, Math.trunc(health.lethal)));
  const aggravated = Math.max(0, Math.min(7, Math.trunc(health.aggravated)));
  const total = bashing + lethal + aggravated;

  if (total <= 7) {
    return { bashing, lethal, aggravated };
  }

  const overflow = total - 7;
  return {
    bashing: Math.max(0, bashing - overflow),
    lethal,
    aggravated
  };
}

export function clampNpcNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function getNpcFallbackLetter(name: string) {
  const normalized = name.trim();
  return normalized ? normalized.charAt(0).toUpperCase() : "—";
}

export function getNpcMetaSubtitle(
  meta: Pick<NpcDto["meta"], "clanKey" | "sectKey" | "generation">,
  dictionaries: AggregatedDictionariesDto
) {
  const clanLabel =
    dictionaries.clans.find((item) => item.key === meta.clanKey)?.labelRu ?? "";
  const sectLabel =
    dictionaries.sects.find((item) => item.key === meta.sectKey)?.labelRu ?? "";
  const generationLabel =
    typeof meta.generation === "number" ? `Поколение ${meta.generation}` : "";

  return [clanLabel, sectLabel, generationLabel].filter(Boolean).join(" · ");
}
