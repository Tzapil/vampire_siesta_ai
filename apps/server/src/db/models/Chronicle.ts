import { Schema, model } from "mongoose";

const ChronicleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    createdByDisplayName: { type: String, required: false, default: "", trim: true },
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "chronicles" }
);

export const ChronicleModel = model("Chronicle", ChronicleSchema);
