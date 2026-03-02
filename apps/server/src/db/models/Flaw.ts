import { Schema, model } from "mongoose";

const FlawSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelRu: { type: String, required: true, trim: true },
    pointCost: { type: Number, required: true, min: 1 },
    description: { type: String, required: true, trim: true, default: "" }
  },
  { timestamps: true, collection: "flaws" }
);

export const FlawModel = model("Flaw", FlawSchema);

