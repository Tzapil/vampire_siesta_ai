import { Schema, model } from "mongoose";

const GenerationSchema = new Schema(
  {
    generation: { type: Number, required: true, min: 8, max: 14, unique: true },
    bloodPoolMax: { type: Number, required: true, min: 0 },
    bloodPerTurn: { type: Number, required: true, min: 0 }
  },
  { timestamps: true, collection: "generations" }
);

export const GenerationModel = model("Generation", GenerationSchema);

