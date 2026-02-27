export type DictItem = {
  key: string;
  labelRu: string;
};

export type ClanDto = DictItem & {
  disciplineKeys: string[];
  rules?: { appearanceFixedTo?: number };
};

export type AttributeDto = DictItem & {
  group: "physical" | "social" | "mental";
};

export type AbilityDto = DictItem & {
  group: "talents" | "skills" | "knowledges";
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

export type ChronicleDto = {
  _id: string;
  name: string;
  description?: string;
};

export type CharacterSummaryDto = {
  uuid: string;
  creationFinished: boolean;
  meta: { name: string; chronicleId: string };
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
