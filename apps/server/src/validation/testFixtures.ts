import type { Dictionaries } from "./dictionaryProvider";

export function createDictionariesFixture(): Dictionaries {
  return {
    clans: new Map([
      [
        "nosferatu",
        {
          key: "nosferatu",
          disciplineKeys: ["animalism", "obfuscate", "potence"],
          rules: { appearanceFixedTo: 0 }
        }
      ],
      [
        "ventrue",
        {
          key: "ventrue",
          disciplineKeys: ["dominate", "fortitude", "presence"],
          rules: {}
        }
      ]
    ]),
    disciplines: [
      { key: "animalism" },
      { key: "obfuscate" },
      { key: "potence" },
      { key: "dominate" }
    ],
    attributes: [
      { key: "strength", group: "physical" },
      { key: "dexterity", group: "physical" },
      { key: "stamina", group: "physical" },
      { key: "charisma", group: "social" },
      { key: "manipulation", group: "social" },
      { key: "appearance", group: "social" },
      { key: "perception", group: "mental" },
      { key: "intelligence", group: "mental" },
      { key: "wits", group: "mental" }
    ],
    abilities: [
      { key: "alertness", group: "talents" },
      { key: "drive", group: "skills" },
      { key: "academics", group: "knowledges" }
    ],
    backgrounds: [{ key: "allies" }],
    virtues: [{ key: "conscience" }, { key: "selfControl" }, { key: "courage" }],
    merits: new Map([
      ["ironWill", { key: "ironWill", pointCost: 3 }],
      ["eatFood", { key: "eatFood", pointCost: 1 }]
    ]),
    flaws: new Map([
      ["enemy", { key: "enemy", pointCost: 3 }],
      ["darkSecret", { key: "darkSecret", pointCost: 4 }],
      ["preyExclusion", { key: "preyExclusion", pointCost: 1 }]
    ]),
    sects: new Map([["camarilla", { key: "camarilla" }]]),
    natures: new Map([["architect", { key: "architect" }]]),
    demeanors: new Map([["bonVivant", { key: "bonVivant" }]]),
    generations: new Map([
      [13, { generation: 13, bloodPoolMax: 10, bloodPerTurn: 1 }],
      [12, { generation: 12, bloodPoolMax: 11, bloodPerTurn: 1 }]
    ])
  };
}

export function createCharacterFixture() {
  const dictionaries = createDictionariesFixture();
  const layered = (base: number) => ({ base, freebie: 0, storyteller: 0 });

  return {
    meta: {
      name: "Test",
      playerName: "Player",
      clanKey: "ventrue",
      generation: 13,
      chronicleId: "chronicle-1",
      sectKey: "camarilla",
      natureKey: "architect",
      demeanorKey: "bonVivant"
    },
    creationFinished: false,
    creation: {
      attributesPriority: { physical: "primary", social: "secondary", mental: "tertiary" },
      abilitiesPriority: { talents: "primary", skills: "secondary", knowledges: "tertiary" },
      flawFreebieEarned: 0,
      freebieBuys: { humanity: 0, willpower: 0 }
    },
    traits: {
      attributes: Object.fromEntries(dictionaries.attributes.map((item) => [item.key, layered(1)])),
      abilities: Object.fromEntries(dictionaries.abilities.map((item) => [item.key, layered(0)])),
      disciplines: Object.fromEntries(dictionaries.disciplines.map((item) => [item.key, layered(0)])),
      backgrounds: Object.fromEntries(dictionaries.backgrounds.map((item) => [item.key, layered(0)])),
      virtues: Object.fromEntries(dictionaries.virtues.map((item) => [item.key, layered(1)])),
      merits: [] as string[],
      flaws: [] as string[]
    },
    derived: {
      bloodPoolMax: 10,
      bloodPerTurn: 1
    },
    resources: {
      bloodPool: { current: 0 },
      willpower: { current: 0 },
      humanity: { current: 0 },
      health: { bashing: 0, lethal: 0, aggravated: 0 }
    },
    notes: "",
    equipment: ""
  };
}
