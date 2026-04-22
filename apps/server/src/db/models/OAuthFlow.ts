import { Schema, model } from "mongoose";

const OAuthFlowSchema = new Schema(
  {
    stateHash: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ["google", "yandex"], required: true },
    nextPath: { type: String, required: true, default: "/" },
    nonce: { type: String, required: true },
    codeVerifier: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true, collection: "oauth_flows" }
);

OAuthFlowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthFlowModel = model("OAuthFlow", OAuthFlowSchema);
