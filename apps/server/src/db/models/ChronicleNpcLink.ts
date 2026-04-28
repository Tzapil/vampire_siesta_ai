import { Schema, model } from "mongoose";

const ChronicleNpcLinkSchema = new Schema(
  {
    chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true },
    npcId: { type: Schema.Types.ObjectId, ref: "Npc", required: true },
    addedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: false }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "chronicle_npcs"
  }
);

ChronicleNpcLinkSchema.index({ chronicleId: 1, npcId: 1 }, { unique: true });
ChronicleNpcLinkSchema.index({ chronicleId: 1 });
ChronicleNpcLinkSchema.index({ npcId: 1 });

export const ChronicleNpcLinkModel = model("ChronicleNpcLink", ChronicleNpcLinkSchema);
