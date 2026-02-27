import { Schema, model } from "mongoose";

const AbilitySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelRu: { type: String, required: true, trim: true },
    group: { type: String, enum: ["talents", "skills", "knowledges"], required: true }
  },
  { timestamps: true, collection: "abilities" }
);

export const AbilityModel = model("Ability", AbilitySchema);

