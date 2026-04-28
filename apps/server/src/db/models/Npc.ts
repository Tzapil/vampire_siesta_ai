import { Schema, model } from "mongoose";

const NpcHealthSchema = new Schema(
  {
    bashing: { type: Number, required: true, default: 0 },
    lethal: { type: Number, required: true, default: 0 },
    aggravated: { type: Number, required: true, default: 0 }
  },
  { _id: false }
);

const NpcResourcesSchema = new Schema(
  {
    bloodPool: {
      current: { type: Number, required: true, default: 0 }
    },
    willpower: {
      current: { type: Number, required: true, default: 0 }
    },
    humanity: {
      current: { type: Number, required: true, default: 0 }
    },
    health: { type: NpcHealthSchema, required: true, default: () => ({}) }
  },
  { _id: false }
);

const NpcSchema = new Schema(
  {
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    createdByDisplayName: { type: String, required: false, default: "", trim: true },
    deleted: { type: Boolean, required: true, default: false, index: true },
    deletedAt: { type: Date, required: false },
    meta: {
      name: { type: String, required: true, trim: true },
      avatarUrl: { type: String, required: false, default: "", trim: true },
      clanKey: { type: String, required: false, default: "" },
      sectKey: { type: String, required: false, default: "" },
      generation: { type: Number, required: false, min: 8, max: 14 }
    },
    traits: {
      attributes: { type: Map, of: Number, required: true, default: {} },
      abilities: { type: Map, of: Number, required: true, default: {} },
      disciplines: { type: Map, of: Number, required: true, default: {} },
      virtues: { type: Map, of: Number, required: true, default: {} }
    },
    resources: { type: NpcResourcesSchema, required: true, default: () => ({}) },
    notes: { type: String, required: false, default: "", trim: true }
  },
  { timestamps: true, collection: "npcs" }
);

NpcSchema.index({ deleted: 1, createdAt: -1 });
NpcSchema.index({ createdAt: -1 });

export const NpcModel = model("Npc", NpcSchema);
