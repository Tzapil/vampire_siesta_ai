export type DictItem = {
  key: string;
  labelRu: string;
  description?: string;
  category?: string;
  maxValue?: number;
};

export type ClanDto = DictItem & {
  disciplineKeys: string[];
  rules?: { appearanceFixedTo?: number };
};

export type AttributeDto = DictItem & {
  group: "physical" | "social" | "mental";
  specializationAt?: number;
  specializationDescription?: string;
  pageRef?: string;
};

export type AbilityDto = DictItem & {
  group: "talents" | "skills" | "knowledges";
  specializationAt?: number;
  specializationDescription?: string;
  pageRef?: string;
};

export type GenerationDto = {
  generation: number;
  bloodPoolMax: number;
  bloodPerTurn: number;
};

export type MeritDto = DictItem & {
  pointCost: number;
};

export type FlawDto = DictItem & {
  pointCost: number;
};

export type AggregatedDictionariesDto = {
  clans: ClanDto[];
  disciplines: DictItem[];
  attributes: AttributeDto[];
  abilities: AbilityDto[];
  backgrounds: DictItem[];
  virtues: DictItem[];
  merits: MeritDto[];
  flaws: FlawDto[];
  sects: DictItem[];
  natures: DictItem[];
  demeanors: DictItem[];
  generations: GenerationDto[];
};
