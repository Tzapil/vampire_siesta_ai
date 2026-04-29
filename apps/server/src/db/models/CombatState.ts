import { Schema, model } from "mongoose";

const InitiativeSchema = new Schema(
  {
    dexterity: { type: Number, default: 0 },
    wits: { type: Number, default: 0 },
    base: { type: Number, default: 0 },
    roll: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    manual: { type: Boolean, default: false }
  },
  { _id: false }
);

const EnemySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    dexterity: { type: Number, default: 0 },
    wits: { type: Number, default: 0 },
    health: {
      bashing: { type: Number, default: 0 },
      lethal: { type: Number, default: 0 },
      aggravated: { type: Number, default: 0 }
    },
    dead: { type: Boolean, default: false },
    initiative: { type: InitiativeSchema, default: undefined }
  },
  { _id: true }
);

const CombatNpcSchema = new Schema(
  {
    npcId: { type: Schema.Types.ObjectId, ref: "Npc", required: true },
    baseName: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    copyOrdinal: { type: Number, required: true, min: 1 },
    avatarUrl: { type: String, required: false, default: "", trim: true },
    clanKey: { type: String, required: false, default: "" },
    sectKey: { type: String, required: false, default: "" },
    generation: { type: Number, required: false, min: 8, max: 14 },
    dexterity: { type: Number, required: true, default: 0 },
    wits: { type: Number, required: true, default: 0 },
    health: {
      bashing: { type: Number, required: true, default: 0 },
      lethal: { type: Number, required: true, default: 0 },
      aggravated: { type: Number, required: true, default: 0 }
    },
    dead: { type: Boolean, required: true, default: false },
    initiative: { type: InitiativeSchema, default: undefined }
  },
  { _id: true }
);

const CombatStateSchema = new Schema(
  {
    chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true, unique: true },
    initiatives: { type: Map, of: InitiativeSchema, default: {} },
    npcs: { type: [CombatNpcSchema], default: [] },
    npcCopyCounters: { type: Map, of: Number, default: {} },
    enemies: { type: [EnemySchema], default: [] },
    active: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "combat_states" }
);

export const CombatStateModel = model("CombatState", CombatStateSchema);
