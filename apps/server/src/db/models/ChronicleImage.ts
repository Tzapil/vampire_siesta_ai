import { Schema, model } from "mongoose";

const ChronicleImageSchema = new Schema(
  {
    chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true, index: true },
    dataUrl: { type: String, required: true },
    name: { type: String, trim: true }
  },
  { timestamps: true, collection: "chronicle_images" }
);

ChronicleImageSchema.index({ chronicleId: 1, createdAt: -1 });

export const ChronicleImageModel = model("ChronicleImage", ChronicleImageSchema);
