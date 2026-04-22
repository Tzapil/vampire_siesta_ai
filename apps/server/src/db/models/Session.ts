import { Schema, model } from "mongoose";

const SessionSchema = new Schema(
  {
    sessionIdHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    ip: { type: String, required: false, trim: true },
    userAgent: { type: String, required: false, trim: true }
  },
  { timestamps: true, collection: "sessions" }
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model("Session", SessionSchema);
