import type {
  ChronicleNpcDto,
  CombatInitiativeDto,
  CombatNpcDto,
  CombatStateDto,
  NpcDto,
  NpcSummaryDto
} from "@siesta/shared";

function presentOptionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function presentOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function presentHealth(value: any) {
  return {
    bashing: Number(value?.bashing ?? 0),
    lethal: Number(value?.lethal ?? 0),
    aggravated: Number(value?.aggravated ?? 0)
  };
}

function presentNpcMeta(meta: any) {
  return {
    name: typeof meta?.name === "string" ? meta.name.trim() : "",
    avatarUrl: presentOptionalText(meta?.avatarUrl),
    clanKey: presentOptionalText(meta?.clanKey),
    sectKey: presentOptionalText(meta?.sectKey),
    generation: presentOptionalNumber(meta?.generation) ?? null
  };
}

function presentNumericRecord(value: any) {
  if (!value) {
    return {};
  }

  const source =
    value instanceof Map ? Object.fromEntries(value.entries()) : { ...(value ?? {}) };

  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, Number(item ?? 0)])
  );
}

export function presentNpc(input: any): NpcDto {
  return {
    id: String(input?._id ?? input?.id ?? ""),
    meta: presentNpcMeta(input?.meta),
    traits: {
      attributes: presentNumericRecord(input?.traits?.attributes),
      abilities: presentNumericRecord(input?.traits?.abilities),
      disciplines: presentNumericRecord(input?.traits?.disciplines),
      virtues: presentNumericRecord(input?.traits?.virtues)
    },
    resources: {
      bloodPool: { current: Number(input?.resources?.bloodPool?.current ?? 0) },
      willpower: { current: Number(input?.resources?.willpower?.current ?? 0) },
      humanity: { current: Number(input?.resources?.humanity?.current ?? 0) },
      health: presentHealth(input?.resources?.health)
    },
    notes: typeof input?.notes === "string" ? input.notes : "",
    createdByUserId: input?.createdByUserId ? String(input.createdByUserId) : undefined,
    createdByDisplayName: presentOptionalText(input?.createdByDisplayName),
    createdAt: toIso(input?.createdAt),
    updatedAt: toIso(input?.updatedAt)
  };
}

export function presentNpcSummary(input: any): NpcSummaryDto {
  return {
    id: String(input?._id ?? input?.id ?? ""),
    meta: presentNpcMeta(input?.meta),
    createdByDisplayName: presentOptionalText(input?.createdByDisplayName),
    createdAt: toIso(input?.createdAt),
    updatedAt: toIso(input?.updatedAt)
  };
}

export function presentChronicleNpc(npc: any, link: any): ChronicleNpcDto {
  const summary = presentNpcSummary(npc);
  return {
    ...summary,
    chronicleId: String(link?.chronicleId ?? ""),
    linkedAt: toIso(link?.createdAt),
    addedByUserId: link?.addedByUserId ? String(link.addedByUserId) : undefined
  };
}

function presentCombatInitiative(input: any): CombatInitiativeDto {
  const manual = Boolean(input?.manual);
  return {
    dexterity: Number(input?.dexterity ?? 0),
    wits: Number(input?.wits ?? 0),
    base: Number(input?.base ?? 0),
    roll: Number(input?.roll ?? 0),
    total: Number(input?.total ?? 0),
    ...(manual ? { manual: true } : {})
  };
}

export function presentCombatNpc(input: any): CombatNpcDto {
  return {
    _id: String(input?._id ?? ""),
    npcId: String(input?.npcId ?? ""),
    baseName: typeof input?.baseName === "string" ? input.baseName : "",
    displayName: typeof input?.displayName === "string" ? input.displayName : "",
    copyOrdinal: Number(input?.copyOrdinal ?? 0),
    avatarUrl: presentOptionalText(input?.avatarUrl),
    clanKey: presentOptionalText(input?.clanKey),
    sectKey: presentOptionalText(input?.sectKey),
    generation: presentOptionalNumber(input?.generation) ?? null,
    dexterity: Number(input?.dexterity ?? 0),
    wits: Number(input?.wits ?? 0),
    health: presentHealth(input?.health),
    dead: Boolean(input?.dead),
    initiative: input?.initiative ? presentCombatInitiative(input.initiative) : undefined
  };
}

export function presentCombatState(input: any): CombatStateDto {
  const source =
    input?.initiatives instanceof Map
      ? Object.fromEntries(input.initiatives.entries())
      : { ...(input?.initiatives ?? {}) };
  return {
    _id: String(input?._id ?? ""),
    chronicleId: String(input?.chronicleId ?? ""),
    initiatives: Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, presentCombatInitiative(value)])
    ),
    npcs: Array.isArray(input?.npcs) ? input.npcs.map((item: any) => presentCombatNpc(item)) : [],
    active: Boolean(input?.active)
  };
}
