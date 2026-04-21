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
} from "../db";
import type { GenerationRecord } from "./valueObjects";

type ClanEntry = {
  key: string;
  disciplineKeys?: string[];
  rules?: {
    appearanceFixedTo?: number;
  };
};

type KeyOnly = { key: string };
type AttributeEntry = { key: string; group: "physical" | "social" | "mental" };
type AbilityEntry = { key: string; group: "talents" | "skills" | "knowledges" };
type MeritOrFlawEntry = { key: string; pointCost: number };

export type Dictionaries = {
  clans: Map<string, ClanEntry>;
  disciplines: KeyOnly[];
  attributes: AttributeEntry[];
  abilities: AbilityEntry[];
  backgrounds: KeyOnly[];
  virtues: KeyOnly[];
  merits: Map<string, MeritOrFlawEntry>;
  flaws: Map<string, MeritOrFlawEntry>;
  sects: Map<string, KeyOnly>;
  natures: Map<string, KeyOnly>;
  demeanors: Map<string, KeyOnly>;
  generations: Map<number, GenerationRecord>;
};

export type DictionaryCacheStats = {
  hits: number;
  misses: number;
  lastLoadedAt: number | null;
  ttlMs: number;
};

export interface DictionaryProvider {
  getDictionaries(): Promise<Dictionaries>;
  invalidateCache(): void;
  getCacheStats(): DictionaryCacheStats;
}

export type DictionaryLoader = () => Promise<Dictionaries>;

const DICT_TTL_MS = 60_000;

export class CachedDictionaryProvider implements DictionaryProvider {
  private cached: { value: Dictionaries; ts: number } | null = null;
  private hits = 0;
  private misses = 0;
  private lastLoadedAt: number | null = null;

  constructor(
    private readonly loader: DictionaryLoader,
    private readonly ttlMs = DICT_TTL_MS,
    private readonly now: () => number = () => Date.now()
  ) {}

  async getDictionaries(): Promise<Dictionaries> {
    if (this.cached && this.now() - this.cached.ts < this.ttlMs) {
      this.hits += 1;
      return this.cached.value;
    }

    this.misses += 1;
    const value = await this.loader();
    const ts = this.now();
    this.cached = { value, ts };
    this.lastLoadedAt = ts;
    return value;
  }

  invalidateCache() {
    this.cached = null;
  }

  getCacheStats(): DictionaryCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      lastLoadedAt: this.lastLoadedAt,
      ttlMs: this.ttlMs
    };
  }
}

export async function loadDictionariesFromMongo(): Promise<Dictionaries> {
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
    ClanModel.find().lean(),
    DisciplineModel.find().select("key").lean(),
    AttributeModel.find().select("key group").lean(),
    AbilityModel.find().select("key group").lean(),
    BackgroundModel.find().select("key").lean(),
    VirtueModel.find().select("key").lean(),
    MeritModel.find().select("key pointCost").lean(),
    FlawModel.find().select("key pointCost").lean(),
    SectModel.find().select("key").lean(),
    NatureModel.find().select("key").lean(),
    DemeanorModel.find().select("key").lean(),
    GenerationModel.find().select("generation bloodPoolMax bloodPerTurn").lean()
  ]);

  return {
    clans: new Map(clans.map((item: any) => [item.key, item])),
    disciplines: disciplines.map((item: any) => ({ key: item.key })),
    attributes: attributes.map((item: any) => ({ key: item.key, group: item.group })),
    abilities: abilities.map((item: any) => ({ key: item.key, group: item.group })),
    backgrounds: backgrounds.map((item: any) => ({ key: item.key })),
    virtues: virtues.map((item: any) => ({ key: item.key })),
    merits: new Map(merits.map((item: any) => [item.key, item])),
    flaws: new Map(flaws.map((item: any) => [item.key, item])),
    sects: new Map(sects.map((item: any) => [item.key, item])),
    natures: new Map(natures.map((item: any) => [item.key, item])),
    demeanors: new Map(demeanors.map((item: any) => [item.key, item])),
    generations: new Map(generations.map((item: any) => [item.generation, item]))
  };
}

export function createDefaultDictionaryProvider() {
  return new CachedDictionaryProvider(loadDictionariesFromMongo, DICT_TTL_MS);
}

const defaultProvider = createDefaultDictionaryProvider();

export async function loadDictionaries() {
  return defaultProvider.getDictionaries();
}

export function invalidateDictionaryCache() {
  defaultProvider.invalidateCache();
}

export function getDictionaryCacheStats() {
  return defaultProvider.getCacheStats();
}

export function getDefaultDictionaryProvider() {
  return defaultProvider;
}

export const DEFAULT_DICTIONARY_TTL_MS = DICT_TTL_MS;
