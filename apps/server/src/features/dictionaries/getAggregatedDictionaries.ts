import type { AggregatedDictionariesDto } from "@siesta/shared";
import {
  AbilityModel,
  AttributeModel,
  BackgroundModel,
  ClanModel,
  DemeanorModel,
  DisciplineModel,
  FlawModel,
  GenerationModel,
  MeritModel,
  NatureModel,
  SectModel,
  VirtueModel
} from "../../db";

function normalizeOptionalString(value: string | null | undefined) {
  return value ?? undefined;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return value ?? undefined;
}

function normalizeDictItem<T extends Record<string, unknown>>(item: T) {
  return {
    ...item,
    description: normalizeOptionalString(item.description as string | null | undefined),
    category: normalizeOptionalString(item.category as string | null | undefined),
    maxValue: normalizeOptionalNumber(item.maxValue as number | null | undefined)
  };
}

export async function getAggregatedDictionaries(): Promise<AggregatedDictionariesDto> {
  const [
    clans,
    disciplines,
    attributes,
    abilities,
    backgrounds,
    virtues,
    merits,
    flaws,
    sects,
    natures,
    demeanors,
    generations
  ] = await Promise.all([
    ClanModel.find().select("key labelRu disciplineKeys rules -_id").lean(),
    DisciplineModel.find().select("key labelRu description category -_id").lean(),
    AttributeModel.find()
      .select("key labelRu group description specializationAt specializationDescription pageRef -_id")
      .lean(),
    AbilityModel.find()
      .select("key labelRu group description specializationAt specializationDescription pageRef -_id")
      .lean(),
    BackgroundModel.find().select("key labelRu description maxValue -_id").lean(),
    VirtueModel.find().select("key labelRu description -_id").lean(),
    MeritModel.find().select("key labelRu pointCost description -_id").lean(),
    FlawModel.find().select("key labelRu pointCost description -_id").lean(),
    SectModel.find().select("key labelRu description -_id").lean(),
    NatureModel.find().select("key labelRu description -_id").lean(),
    DemeanorModel.find().select("key labelRu description -_id").lean(),
    GenerationModel.find().select("generation bloodPoolMax bloodPerTurn -_id").lean()
  ]);

  return {
    clans: clans.map((item) => ({
      ...normalizeDictItem(item),
      rules: item.rules
        ? {
            appearanceFixedTo: normalizeOptionalNumber(item.rules.appearanceFixedTo)
          }
        : undefined
    })),
    disciplines: disciplines.map(normalizeDictItem),
    attributes: attributes.map((item) => ({
      ...normalizeDictItem(item),
      specializationAt: normalizeOptionalNumber(item.specializationAt),
      specializationDescription: normalizeOptionalString(item.specializationDescription),
      pageRef: normalizeOptionalString(item.pageRef)
    })),
    abilities: abilities.map((item) => ({
      ...normalizeDictItem(item),
      specializationAt: normalizeOptionalNumber(item.specializationAt),
      specializationDescription: normalizeOptionalString(item.specializationDescription),
      pageRef: normalizeOptionalString(item.pageRef)
    })),
    backgrounds: backgrounds.map(normalizeDictItem),
    virtues: virtues.map(normalizeDictItem),
    merits: merits.map(normalizeDictItem),
    flaws: flaws.map(normalizeDictItem),
    sects: sects.map(normalizeDictItem),
    natures: natures.map(normalizeDictItem),
    demeanors: demeanors.map(normalizeDictItem),
    generations
  };
}
