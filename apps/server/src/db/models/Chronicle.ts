import { Schema, model } from "mongoose";

const ChronicleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "chronicles" }
);

export const ChronicleModel = model("Chronicle", ChronicleSchema);

