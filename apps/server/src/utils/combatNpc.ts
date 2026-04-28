import type { CombatInitiativeDto } from "@siesta/shared";
import { validateNpcHealth, type ValidationIssue } from "./npcValidation";

function readMapNumber(source: any, key: string) {
  if (source instanceof Map) {
    return Number(source.get(key) ?? 0);
  }
  return Number(source?.[key] ?? 0);
}

export function createCombatNpcSnapshot(npc: any, nextOrdinal: number) {
  const npcId = String(npc?._id ?? npc?.id ?? "");
  const baseName = typeof npc?.meta?.name === "string" ? npc.meta.name.trim() : "";
  return {
    npcId,
    baseName,
    displayName: `${baseName} #${nextOrdinal}`,
    copyOrdinal: nextOrdinal,
    avatarUrl: typeof npc?.meta?.avatarUrl === "string" ? npc.meta.avatarUrl.trim() : "",
    clanKey: typeof npc?.meta?.clanKey === "string" ? npc.meta.clanKey.trim() : "",
    sectKey: typeof npc?.meta?.sectKey === "string" ? npc.meta.sectKey.trim() : "",
    generation:
      typeof npc?.meta?.generation === "number" && Number.isFinite(npc.meta.generation)
        ? npc.meta.generation
        : undefined,
    dexterity: readMapNumber(npc?.traits?.attributes, "dexterity"),
    wits: readMapNumber(npc?.traits?.attributes, "wits"),
    health: {
      bashing: Number(npc?.resources?.health?.bashing ?? 0),
      lethal: Number(npc?.resources?.health?.lethal ?? 0),
      aggravated: Number(npc?.resources?.health?.aggravated ?? 0)
    },
    dead: false
  };
}

export function getNextNpcCopyOrdinal(counters: any, npcId: string) {
  const current =
    counters instanceof Map ? Number(counters.get(npcId) ?? 0) : Number(counters?.[npcId] ?? 0);
  return Number.isFinite(current) ? current + 1 : 1;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeInitiative(input: unknown, path: string, issues: ValidationIssue[]) {
  if (!isObjectRecord(input)) {
    issues.push({ path, message: "Некорректный формат инициативы" });
    return null;
  }

  const fields = ["dexterity", "wits", "base", "roll", "total"] as const;
  const result: Record<string, number> = {};
  for (const field of fields) {
    const value = input[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ path: `${path}.${field}`, message: "Ожидается число" });
      continue;
    }
    result[field] = Math.trunc(value);
  }

  if (issues.some((issue) => issue.path.startsWith(`${path}.`))) {
    return null;
  }

  return result as CombatInitiativeDto;
}

export function normalizeCombatNpcPatch(input: unknown): {
  value: {
    health?: { bashing: number; lethal: number; aggravated: number };
    dead?: boolean;
    initiative?: CombatInitiativeDto;
  };
  errors: ValidationIssue[];
} {
  const source = isObjectRecord(input) ? input : {};
  const errors: ValidationIssue[] = [];
  const value: {
    health?: { bashing: number; lethal: number; aggravated: number };
    dead?: boolean;
    initiative?: CombatInitiativeDto;
  } = {};

  if (source.health !== undefined) {
    value.health = validateNpcHealth(source.health, "health", errors);
  }

  if (source.dead !== undefined) {
    if (typeof source.dead !== "boolean") {
      errors.push({ path: "dead", message: "Ожидается boolean" });
    } else {
      value.dead = source.dead;
    }
  }

  if (source.initiative !== undefined) {
    const initiative = normalizeInitiative(source.initiative, "initiative", errors);
    if (initiative) {
      value.initiative = initiative;
    }
  }

  if (Object.keys(value).length === 0) {
    errors.push({ path: "body", message: "Нет данных для обновления" });
  }

  return { value, errors };
}
