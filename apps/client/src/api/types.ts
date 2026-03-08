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
  description?: string;
};

export type FlawDto = DictItem & {
  pointCost: number;
  description?: string;
};

export type ChronicleDto = {
  _id: string;
  name: string;
  description?: string;
};

export type ChronicleLogDto = {
  _id: string;
  chronicleId: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
};

export type ChronicleImageDto = {
  _id: string;
  chronicleId: string;
  dataUrl: string;
  name?: string;
  createdAt: string;
};

export type CharacterSummaryDto = {
  uuid: string;
  creationFinished: boolean;
  meta: {
    name: string;
    chronicleId: string;
    avatarUrl?: string;
    playerName?: string;
    clanKey?: string;
    sectKey?: string;
    generation?: number;
  };
};

export type LayeredValue = {
  base: number;
  freebie: number;
  storyteller: number;
};

export type PriorityRank = "primary" | "secondary" | "tertiary";

export type CharacterDto = {
  uuid: string;
  version: number;
  creationFinished: boolean;
  deleted?: boolean;
  meta: {
    name: string;
    playerName: string;
    concept: string;
    sire: string;
    chronicleId: string;
    avatarUrl?: string;
    clanKey: string;
    generation: number;
    sectKey: string;
    natureKey: string;
    demeanorKey: string;
  };
  creation?: {
    attributesPriority?: {
      physical: PriorityRank;
      social: PriorityRank;
      mental: PriorityRank;
    };
    abilitiesPriority?: {
      talents: PriorityRank;
      skills: PriorityRank;
      knowledges: PriorityRank;
    };
    flawFreebieEarned: number;
    freebieBuys: { humanity: number; willpower: number };
  };
  derived: {
    bloodPoolMax: number;
    bloodPerTurn: number;
    willpowerMax: number;
    humanityMax: number;
    startingHumanity: number;
    startingWillpower: number;
  };
  traits: {
    attributes: Record<string, LayeredValue>;
    abilities: Record<string, LayeredValue>;
    disciplines: Record<string, LayeredValue>;
    backgrounds: Record<string, LayeredValue>;
    virtues: Record<string, LayeredValue>;
    merits: string[];
    flaws: string[];
  };
  resources: {
    bloodPool: { current: number };
    willpower: { current: number };
    humanity: { current: number };
    health: { bashing: number; lethal: number; aggravated: number };
  };
  notes: string;
  equipment: string;
  wizard?: { currentStep: number };
};

export type ApiErrorPayload = {
  message?: string;
  errors?: Array<{ path: string; message: string }>;
};
