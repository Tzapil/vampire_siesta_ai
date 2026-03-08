import { Schema, model } from "mongoose";

const AttributeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelRu: { type: String, required: true, trim: true },
    group: { type: String, enum: ["physical", "social", "mental"], required: true },
    specializationAt: { type: Number, required: false },
    specializationDescription: { type: String, required: false, trim: true, default: "" },
    description: { type: String, required: false, trim: true, default: "" },
    pageRef: { type: String, required: false, trim: true, default: "" }
  },
  { timestamps: true, collection: "attributes" }
);

export const AttributeModel = model("Attribute", AttributeSchema);

