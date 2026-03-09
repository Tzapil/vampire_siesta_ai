import { Schema, model } from "mongoose";

const InitiativeSchema = new Schema(
  {
    dexterity: { type: Number, default: 0 },
    wits: { type: Number, default: 0 },
    base: { type: Number, default: 0 },
    roll: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
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

const CombatStateSchema = new Schema(
  {
    chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true, unique: true },
    initiatives: { type: Map, of: InitiativeSchema, default: {} },
    enemies: { type: [EnemySchema], default: [] },
    active: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "combat_states" }
);

CombatStateSchema.index({ chronicleId: 1 });

export const CombatStateModel = model("CombatState", CombatStateSchema);
