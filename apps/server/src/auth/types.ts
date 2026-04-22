export type AuthProvider = "google" | "yandex";

export type UserRole = "player" | "storyteller" | "admin";

export type UserStatus = "active" | "blocked";

export type ProviderProfileMeta = {
  email?: string;
  name?: string;
  pictureUrl?: string;
  locale?: string;
  login?: string;
  defaultAvatarId?: string;
  realName?: string;
};

export type OAuthProviderProfile = {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  profileMeta: ProviderProfileMeta;
};

export type PublicUserProvider = {
  provider: AuthProvider;
  linkedAt: string;
};

export type PublicAuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName: string;
  providers: PublicUserProvider[];
  lastSeenAt: string;
  lastLoginAt: string;
  avatarUrl: string | null;
};

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

export type RequestAuthContext = {
  sessionIdHash: string;
  user: PublicAuthUser;
};

export type EnabledAuthProvider = {
  id: AuthProvider;
  label: string;
  startPath: string;
};
