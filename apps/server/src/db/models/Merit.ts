import { Schema, model } from "mongoose";

const MeritSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelRu: { type: String, required: true, trim: true },
    pointCost: { type: Number, required: true, min: 1 }
  },
  { timestamps: true, collection: "merits" }
);

export const MeritModel = model("Merit", MeritSchema);

