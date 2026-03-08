import { Schema, model } from "mongoose";

const ChronicleLogSchema = new Schema(
  {
    chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true, index: true },
    type: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    data: { type: Schema.Types.Mixed }
  },
  { timestamps: true, collection: "chronicle_logs" }
);

ChronicleLogSchema.index({ chronicleId: 1, createdAt: -1 });

export const ChronicleLogModel = model("ChronicleLog", ChronicleLogSchema);
