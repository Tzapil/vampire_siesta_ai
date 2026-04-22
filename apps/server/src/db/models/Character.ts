import { Schema, model } from "mongoose";

const LayeredValueSchema = new Schema(
  {
    base: { type: Number, required: true },
    freebie: { type: Number, required: true },
    storyteller: { type: Number, required: true }
  },
  { _id: false }
);

const HealthSchema = new Schema(
  {
    bashing: { type: Number, required: true },
    lethal: { type: Number, required: true },
    aggravated: { type: Number, required: true }
  },
  { _id: false }
);

const ResourcesSchema = new Schema(
  {
    bloodPool: { current: { type: Number, required: true } },
    willpower: { current: { type: Number, required: true } },
    humanity: { current: { type: Number, required: true } },
    health: { type: HealthSchema, required: true }
  },
  { _id: false }
);

const WizardSchema = new Schema(
  {
    currentStep: { type: Number, required: true, min: 1, max: 8 }
  },
  { _id: false }
);

const CharacterSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },

    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    createdByDisplayName: { type: String, required: false, default: "", trim: true },

    version: { type: Number, required: true, default: 1 },

    deleted: { type: Boolean, required: true, default: false, index: true },
    deletedAt: { type: Date, required: false },

    creationFinished: { type: Boolean, required: true, default: false },

    wizard: { type: WizardSchema, required: false },

    meta: {
      name: { type: String, required: false, default: "", trim: true },
      playerName: { type: String, required: false, default: "", trim: true },
      concept: { type: String, required: false, default: "", trim: true },
      sire: { type: String, required: false, default: "", trim: true },
      chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true },
      avatarUrl: { type: String, required: false, default: "", trim: true },
      clanKey: { type: String, required: false, default: "" },
      generation: { type: Number, required: true, default: 13, min: 8, max: 14 },
      sectKey: { type: String, required: false, default: "" },
      natureKey: { type: String, required: false, default: "" },
      demeanorKey: { type: String, required: false, default: "" }
    },

    creation: {
      attributesPriority: {
        physical: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },
        social: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },
        mental: { type: String, enum: ["primary", "secondary", "tertiary"], required: false }
      },
      abilitiesPriority: {
        talents: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },
        skills: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },
        knowledges: { type: String, enum: ["primary", "secondary", "tertiary"], required: false }
      },
      flawFreebieEarned: { type: Number, required: true, default: 0, min: 0, max: 7 },
      freebieBuys: {
        humanity: { type: Number, required: true, default: 0, min: 0 },
        willpower: { type: Number, required: true, default: 0, min: 0 }
      }
    },

    derived: {
      bloodPoolMax: { type: Number, required: true, default: 0 },
      bloodPerTurn: { type: Number, required: true, default: 0 },
      willpowerMax: { type: Number, required: true, default: 10 },
      humanityMax: { type: Number, required: true, default: 10 },
      startingHumanity: { type: Number, required: true, default: 0 },
      startingWillpower: { type: Number, required: true, default: 0 }
    },

    traits: {
      attributes: { type: Map, of: LayeredValueSchema, required: true, default: {} },
      abilities: { type: Map, of: LayeredValueSchema, required: true, default: {} },
      disciplines: { type: Map, of: LayeredValueSchema, required: true, default: {} },
      backgrounds: { type: Map, of: LayeredValueSchema, required: true, default: {} },
      virtues: { type: Map, of: LayeredValueSchema, required: true, default: {} },
      merits: { type: [String], required: true, default: [] },
      flaws: { type: [String], required: true, default: [] }
    },

    resources: { type: ResourcesSchema, required: true },

    notes: { type: String, required: false, default: "" },
    equipment: { type: String, required: false, default: "" }
  },
  { timestamps: true }
);

export const CharacterModel = model("Character", CharacterSchema);
