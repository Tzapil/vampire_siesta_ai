import type { Types } from "mongoose";
import { OAuthFlowModel, SessionModel, UserAvatarModel, UserModel } from "../db";
import type {
  AuthProvider,
  ProviderProfileMeta,
  UserRole,
  UserStatus
} from "./types";

export type StoredProviderRecord = {
  provider: AuthProvider;
  providerUserId: string;
  emailAtLink: string;
  linkedAt: Date;
  profileMeta?: ProviderProfileMeta;
};

export type StoredUserRecord = {
  _id: Types.ObjectId;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  providers: StoredProviderRecord[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  lastSeenAt: Date;
};

export type StoredSessionRecord = {
  _id: Types.ObjectId;
  sessionIdHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ip?: string;
  userAgent?: string;
};

export type StoredAvatarRecord = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  dataUrl: string;
  updatedAt: Date;
};

export type StoredOAuthFlowRecord = {
  _id: Types.ObjectId;
  stateHash: string;
  provider: AuthProvider;
  nextPath: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: Date;
};

export async function createOAuthFlowRecord(payload: {
  stateHash: string;
  provider: AuthProvider;
  nextPath: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: Date;
}) {
  await OAuthFlowModel.create(payload);
}

export async function consumeOAuthFlowRecord(stateHash: string) {
  return (await OAuthFlowModel.findOneAndDelete({ stateHash }).lean()) as StoredOAuthFlowRecord | null;
}

export async function findUserById(userId: Types.ObjectId | string) {
  return (await UserModel.findById(userId).lean()) as StoredUserRecord | null;
}

export async function findUserByEmail(email: string) {
  return (await UserModel.findOne({ email }).lean()) as StoredUserRecord | null;
}

export async function findUserByProvider(provider: AuthProvider, providerUserId: string) {
  return (await UserModel.findOne({
    providers: {
      $elemMatch: {
        provider,
        providerUserId
      }
    }
  }).lean()) as StoredUserRecord | null;
}

export async function createUserRecord(payload: {
  email: string;
  emailVerified: boolean;
  displayName: string;
  role?: UserRole;
  status?: UserStatus;
  providers: StoredProviderRecord[];
  lastLoginAt: Date;
  lastSeenAt: Date;
}) {
  return (await UserModel.create(payload)).toObject() as StoredUserRecord;
}

export async function updateUserRecord(
  userId: Types.ObjectId | string,
  update: Record<string, unknown>
) {
  return (await UserModel.findByIdAndUpdate(userId, update, {
    new: true
  }).lean()) as StoredUserRecord | null;
}

export async function createSessionRecord(payload: {
  sessionIdHash: string;
  userId: Types.ObjectId | string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}) {
  await SessionModel.create(payload);
}

export async function findSessionByHash(sessionIdHash: string) {
  return (await SessionModel.findOne({ sessionIdHash }).lean()) as StoredSessionRecord | null;
}

export async function updateSessionRecord(
  sessionIdHash: string,
  update: Record<string, unknown>
) {
  return (await SessionModel.findOneAndUpdate({ sessionIdHash }, update, {
    new: true
  }).lean()) as StoredSessionRecord | null;
}

export async function deleteSessionByHash(sessionIdHash: string) {
  await SessionModel.deleteOne({ sessionIdHash });
}

export async function findAvatarByUserId(userId: Types.ObjectId | string) {
  return (await UserAvatarModel.findOne({ userId }).lean()) as StoredAvatarRecord | null;
}

export async function upsertAvatar(userId: Types.ObjectId | string, dataUrl: string) {
  return (await UserAvatarModel.findOneAndUpdate(
    { userId },
    { $set: { dataUrl } },
    { new: true, upsert: true }
  ).lean()) as StoredAvatarRecord;
}
