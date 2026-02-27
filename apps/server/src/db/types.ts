export type LayeredValue = {
  base: number;
  freebie: number;
  storyteller: number;
};

export type Health = {
  bashing: number;
  lethal: number;
  aggravated: number;
};

export type Resources = {
  bloodPool: { current: number };
  willpower: { current: number };
  humanity: { current: number };
  health: Health;
};

export type WizardState = {
  currentStep: number;
};

export type PriorityRank = "primary" | "secondary" | "tertiary";

export type AttributesPriority = {
  physical: PriorityRank;
  social: PriorityRank;
  mental: PriorityRank;
};

export type AbilitiesPriority = {
  talents: PriorityRank;
  skills: PriorityRank;
  knowledges: PriorityRank;
};

export type CreationState = {
  attributesPriority?: AttributesPriority;
  abilitiesPriority?: AbilitiesPriority;
  flawFreebieEarned: number;
  freebieBuys: {
    humanity: number;
    willpower: number;
  };
};

export type Derived = {
  bloodPoolMax: number;
  bloodPerTurn: number;
  willpowerMax: number;
  humanityMax: number;
  startingHumanity: number;
  startingWillpower: number;
};

