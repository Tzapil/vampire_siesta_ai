import { Schema, model } from "mongoose";

export function makeKeyLabelModel(name: string, collection: string) {
  const schema = new Schema(
    {
      key: { type: String, required: true, unique: true, trim: true },
      labelRu: { type: String, required: true, trim: true }
    },
    { timestamps: true, collection }
  );
  return model(name, schema);
}

