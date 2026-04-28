import type { NpcHealth, NpcInputDto } from "@siesta/shared";
import {
  AbilityModel,
  AttributeModel,
  ClanModel,
  DisciplineModel,
  SectModel,
  VirtueModel
} from "../db";

export type ValidationIssue = {
  path: string;
  message: string;
};

type NpcDictionaryState = {
  attributeKeys: string[];
  abilityKeys: string[];
  disciplineKeys: string[];
  virtueKeys: string[];
  clanKeys: Set<string>;
  sectKeys: Set<string>;
};

type NpcPersistedInput = NpcInputDto & {
  meta: {
    name: string;
    avatarUrl: string;
    clanKey: string;
    sectKey: string;
    generation?: number;
  };
  notes: string;
};

const DEFAULT_HEALTH: NpcHealth = { bashing: 0, lethal: 0, aggravated: 0 };

export async function loadNpcDictionaryState(): Promise<NpcDictionaryState> {
  const [attributes, abilities, disciplines, virtues, clans, sects] = await Promise.all([
    AttributeModel.find().select("key").lean(),
    AbilityModel.find().select("key").lean(),
    DisciplineModel.find().select("key").lean(),
    VirtueModel.find().select("key").lean(),
    ClanModel.find().select("key").lean(),
    SectModel.find().select("key").lean()
  ]);

  return {
    attributeKeys: attributes.map((item) => item.key),
    abilityKeys: abilities.map((item) => item.key),
    disciplineKeys: disciplines.map((item) => item.key),
    virtueKeys: virtues.map((item) => item.key),
    clanKeys: new Set(clans.map((item) => item.key)),
    sectKeys: new Set(sects.map((item) => item.key))
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function buildTraitRecord(
  rawGroup: unknown,
  keys: string[],
  defaultsTo: number,
  min: number,
  max: number,
  path: string,
  issues: ValidationIssue[]
) {
  const source = isObjectRecord(rawGroup) ? rawGroup : {};
  const validKeys = new Set(keys);

  Object.keys(source).forEach((key) => {
    if (!validKeys.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        message: "Неизвестное значение словаря"
      });
    }
  });

  return Object.fromEntries(
    keys.map((key) => {
      const rawValue = source[key];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        return [key, defaultsTo];
      }
      const parsed = toFiniteInteger(rawValue);
      if (parsed === null || parsed < min || parsed > max) {
        issues.push({
          path: `${path}.${key}`,
          message: `Допустимый диапазон: ${min}-${max}`
        });
        return [key, defaultsTo];
      }
      return [key, parsed];
    })
  );
}

export function validateNpcHealth(health: unknown, path: string, issues: ValidationIssue[]): NpcHealth {
  const source = isObjectRecord(health) ? health : {};
  const bashing = toFiniteInteger(source.bashing) ?? 0;
  const lethal = toFiniteInteger(source.lethal) ?? 0;
  const aggravated = toFiniteInteger(source.aggravated) ?? 0;

  if (bashing < 0 || bashing > 7) {
    issues.push({ path: `${path}.bashing`, message: "Допустимый диапазон: 0-7" });
  }
  if (lethal < 0 || lethal > 7) {
    issues.push({ path: `${path}.lethal`, message: "Допустимый диапазон: 0-7" });
  }
  if (aggravated < 0 || aggravated > 7) {
    issues.push({ path: `${path}.aggravated`, message: "Допустимый диапазон: 0-7" });
  }
  if (bashing + lethal + aggravated > 7) {
    issues.push({ path, message: "Сумма повреждений не может превышать 7" });
  }

  return {
    bashing: Math.max(0, Math.min(7, bashing)),
    lethal: Math.max(0, Math.min(7, lethal)),
    aggravated: Math.max(0, Math.min(7, aggravated))
  };
}

function buildResourceValue(
  rawValue: unknown,
  min: number,
  max: number,
  path: string,
  issues: ValidationIssue[]
) {
  const parsed = toFiniteInteger(rawValue);
  if (parsed === null) {
    return 0;
  }
  if (parsed < min || parsed > max) {
    issues.push({ path, message: `Допустимый диапазон: ${min}-${max}` });
  }
  return Math.max(min, Math.min(max, parsed));
}

export async function normalizeNpcInput(input: unknown): Promise<{
  value: NpcPersistedInput;
  errors: ValidationIssue[];
}> {
  const dictionaries = await loadNpcDictionaryState();
  const source = isObjectRecord(input) ? input : {};
  const meta = isObjectRecord(source.meta) ? source.meta : {};
  const traits = isObjectRecord(source.traits) ? source.traits : {};
  const resources = isObjectRecord(source.resources) ? source.resources : {};
  const bloodPool = isObjectRecord(resources.bloodPool) ? resources.bloodPool : {};
  const willpower = isObjectRecord(resources.willpower) ? resources.willpower : {};
  const humanity = isObjectRecord(resources.humanity) ? resources.humanity : {};
  const errors: ValidationIssue[] = [];

  const name = toTrimmedString(meta.name).slice(0, 80);
  if (!name) {
    errors.push({ path: "meta.name", message: "Имя обязательно" });
  }

  const avatarUrl = toOptionalString(meta.avatarUrl);
  const clanKey = toOptionalString(meta.clanKey);
  if (clanKey && !dictionaries.clanKeys.has(clanKey)) {
    errors.push({ path: "meta.clanKey", message: "Неизвестный клан" });
  }

  const sectKey = toOptionalString(meta.sectKey);
  if (sectKey && !dictionaries.sectKeys.has(sectKey)) {
    errors.push({ path: "meta.sectKey", message: "Неизвестная секта" });
  }

  const rawGeneration = meta.generation;
  const generationValue =
    rawGeneration === undefined || rawGeneration === null || rawGeneration === ""
      ? null
      : toFiniteInteger(rawGeneration);
  if (generationValue !== null && (generationValue < 8 || generationValue > 14)) {
    errors.push({ path: "meta.generation", message: "Допустимый диапазон: 8-14" });
  }

  const normalized: NpcPersistedInput = {
    meta: {
      name,
      avatarUrl,
      clanKey,
      sectKey,
      generation:
        generationValue === null ? undefined : Math.max(8, Math.min(14, generationValue))
    },
    traits: {
      attributes: buildTraitRecord(
        traits.attributes,
        dictionaries.attributeKeys,
        1,
        1,
        5,
        "traits.attributes",
        errors
      ),
      abilities: buildTraitRecord(
        traits.abilities,
        dictionaries.abilityKeys,
        0,
        0,
        5,
        "traits.abilities",
        errors
      ),
      disciplines: buildTraitRecord(
        traits.disciplines,
        dictionaries.disciplineKeys,
        0,
        0,
        5,
        "traits.disciplines",
        errors
      ),
      virtues: buildTraitRecord(
        traits.virtues,
        dictionaries.virtueKeys,
        1,
        1,
        5,
        "traits.virtues",
        errors
      )
    },
    resources: {
      bloodPool: {
        current: buildResourceValue(
          bloodPool.current,
          0,
          50,
          "resources.bloodPool.current",
          errors
        )
      },
      willpower: {
        current: buildResourceValue(
          willpower.current,
          0,
          10,
          "resources.willpower.current",
          errors
        )
      },
      humanity: {
        current: buildResourceValue(
          humanity.current,
          0,
          10,
          "resources.humanity.current",
          errors
        )
      },
      health: validateNpcHealth(resources.health ?? DEFAULT_HEALTH, "resources.health", errors)
    },
    notes: typeof source.notes === "string" ? source.notes.trim().slice(0, 5000) : ""
  };

  return { value: normalized, errors };
}

export function normalizeSearchQuery(rawValue: unknown) {
  return typeof rawValue === "string" ? rawValue.trim().slice(0, 80) : "";
}

export function buildSearchRegex(rawValue: string) {
  const escaped = rawValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}
