import { Schema, model } from "mongoose";

const UserProviderSchema = new Schema(
  {
    provider: { type: String, enum: ["google", "yandex"], required: true },
    providerUserId: { type: String, required: true },
    emailAtLink: { type: String, required: true, trim: true, lowercase: true },
    linkedAt: { type: Date, required: true, default: () => new Date() },
    profileMeta: {
      email: { type: String, required: false, trim: true, lowercase: true },
      name: { type: String, required: false, trim: true },
      pictureUrl: { type: String, required: false, trim: true },
      locale: { type: String, required: false, trim: true },
      login: { type: String, required: false, trim: true },
      defaultAvatarId: { type: String, required: false, trim: true },
      realName: { type: String, required: false, trim: true }
    }
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    emailVerified: { type: Boolean, required: true, default: false },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    role: {
      type: String,
      enum: ["player", "storyteller", "admin"],
      required: true,
      default: "player"
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      required: true,
      default: "active",
      index: true
    },
    providers: { type: [UserProviderSchema], required: true, default: [] },
    lastLoginAt: { type: Date, required: true, default: () => new Date() },
    lastSeenAt: { type: Date, required: true, default: () => new Date() }
  },
  { timestamps: true, collection: "users" }
);

UserSchema.index(
  { "providers.provider": 1, "providers.providerUserId": 1 },
  { unique: true, sparse: true }
);

export const UserModel = model("User", UserSchema);
