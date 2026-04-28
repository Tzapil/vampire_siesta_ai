import type {
  AbilityDto as SharedAbilityDto,
  AggregatedDictionariesDto as SharedAggregatedDictionariesDto,
  AttributeDto as SharedAttributeDto,
  CharacterSummaryDto as SharedCharacterSummaryDto,
  ChronicleNpcDto as SharedChronicleNpcDto,
  ChronicleDto as SharedChronicleDto,
  ClanDto as SharedClanDto,
  CombatInitiativeDto as SharedCombatInitiativeDto,
  CombatNpcDto as SharedCombatNpcDto,
  CombatStateDto as SharedCombatStateDto,
  DictItem as SharedDictItem,
  FlawDto as SharedFlawDto,
  GenerationDto as SharedGenerationDto,
  HomeScreenDto as SharedHomeScreenDto,
  LayeredValue as SharedLayeredValue,
  MeritDto as SharedMeritDto,
  NpcDto as SharedNpcDto,
  NpcInputDto as SharedNpcInputDto,
  NpcSummaryDto as SharedNpcSummaryDto
} from "@siesta/shared";

export type DictItem = SharedDictItem;
export type ClanDto = SharedClanDto;
export type AttributeDto = SharedAttributeDto;
export type AbilityDto = SharedAbilityDto;
export type GenerationDto = SharedGenerationDto;
export type MeritDto = SharedMeritDto;
export type FlawDto = SharedFlawDto;
export type ChronicleDto = SharedChronicleDto;
export type CharacterSummaryDto = SharedCharacterSummaryDto;
export type LayeredValue = SharedLayeredValue;
export type AggregatedDictionariesDto = SharedAggregatedDictionariesDto;
export type HomeScreenDto = SharedHomeScreenDto;
export type NpcInputDto = SharedNpcInputDto;
export type NpcDto = SharedNpcDto;
export type NpcSummaryDto = SharedNpcSummaryDto;
export type ChronicleNpcDto = SharedChronicleNpcDto;
export type CombatInitiativeDto = SharedCombatInitiativeDto;
export type CombatNpcDto = SharedCombatNpcDto;
export type CombatStateDto = SharedCombatStateDto;

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

export type AuthProviderId = "google" | "yandex";

export type AuthProviderOptionDto = {
  id: AuthProviderId;
  label: string;
  startPath: string;
};

export type AuthUserDto = {
  id: string;
  email: string;
  role: "player" | "storyteller" | "admin";
  status: "active" | "blocked";
  displayName: string;
  providers: Array<{
    provider: AuthProviderId;
    linkedAt: string;
  }>;
  lastSeenAt: string;
  lastLoginAt: string;
  avatarUrl: string | null;
};

export type PriorityRank = "primary" | "secondary" | "tertiary";

export type CharacterDto = {
  uuid: string;
  version: number;
  creationFinished: boolean;
  createdByUserId?: string;
  createdByDisplayName?: string;
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
