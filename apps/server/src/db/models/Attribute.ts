import { Schema, model } from "mongoose";

const AttributeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelRu: { type: String, required: true, trim: true },
    group: { type: String, enum: ["physical", "social", "mental"], required: true }
  },
  { timestamps: true, collection: "attributes" }
);

export const AttributeModel = model("Attribute", AttributeSchema);

