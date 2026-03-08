import { Schema, model } from "mongoose";

const ClanSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelRu: { type: String, required: true, trim: true },
    disciplineKeys: { type: [String], required: true, default: [] },
    weakness: { type: String, required: false, trim: true, default: "" },
    rules: {
      appearanceFixedTo: { type: Number, required: false }
    }
  },
  { timestamps: true, collection: "clans" }
);

export const ClanModel = model("Clan", ClanSchema);

