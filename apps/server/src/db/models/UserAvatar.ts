import { Schema, model } from "mongoose";

const UserAvatarSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    dataUrl: { type: String, required: true }
  },
  {
    collection: "user_avatars",
    timestamps: { createdAt: false, updatedAt: true }
  }
);

export const UserAvatarModel = model("UserAvatar", UserAvatarSchema);
