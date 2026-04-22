import type { AppConfig } from "../config";
import { getAppConfig } from "../config";
import { parseCookies, serializeCookie } from "./cookies";
import { createPkcePair, createRandomToken, decodeJwtPayload, sha256Hex } from "./crypto";
import { AuthError } from "./errors";
import * as repository from "./repository";
import type {
  AuthProvider,
  EnabledAuthProvider,
  OAuthProviderProfile,
  PublicAuthUser,
  RequestAuthContext,
  RequestMeta
} from "./types";
import {
  buildAvatarUrl,
  createInitialDisplayName,
  normalizeDisplayName,
  normalizeEmail,
  sanitizeNextPath,
  validateImageDataUrl
} from "./utils";

type SessionResolution = {
  auth: RequestAuthContext | null;
  clearCookie: boolean;
  refreshCookie: boolean;
};

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
};

type YandexTokenResponse = {
  access_token?: string;
};

type YandexUserInfoResponse = {
  id?: string | number;
  default_email?: string;
  display_name?: string;
  real_name?: string;
  login?: string;
  default_avatar_id?: string;
};

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: "Google",
  yandex: "Yandex"
};

function isGoogleIssuer(value: unknown) {
  return value === "https://accounts.google.com" || value === "accounts.google.com";
}

async function readJsonResponse<T>(response: Response) {
  const text = await response.text();
  if (!text) {
    return null as T | null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T | null;
  }
}

export class AuthService {
  constructor(private readonly config: AppConfig = getAppConfig()) {}

  getEnabledProviders(): EnabledAuthProvider[] {
    const providers = Object.keys(this.config.auth.providers) as AuthProvider[];
    return providers.map((provider) => ({
      id: provider,
      label: PROVIDER_LABELS[provider],
      startPath: `/api/auth/${provider}/start`
    }));
  }

  readSessionIdFromCookieHeader(cookieHeader?: string) {
    const cookies = parseCookies(cookieHeader);
    const value = cookies[this.config.auth.sessionCookieName];
    return value || null;
  }

  createSessionCookie(sessionId: string) {
    return serializeCookie(this.config.auth.sessionCookieName, sessionId, {
      httpOnly: true,
      path: "/",
      sameSite: this.config.auth.sessionSameSite,
      secure: this.config.auth.sessionSecure,
      maxAgeSeconds: this.config.auth.sessionTtlMs / 1000
    });
  }

  createClearedSessionCookie() {
    return serializeCookie(this.config.auth.sessionCookieName, "", {
      httpOnly: true,
      path: "/",
      sameSite: this.config.auth.sessionSameSite,
      secure: this.config.auth.sessionSecure,
      maxAgeSeconds: 0,
      expires: new Date(0)
    });
  }

  async startAuthorization(provider: AuthProvider, nextPath: unknown) {
    const providerConfig = this.config.auth.providers[provider];
    if (!providerConfig) {
      throw new AuthError("provider_unavailable");
    }

    const state = createRandomToken();
    const nonce = createRandomToken();
    const pkce = createPkcePair();

    await repository.createOAuthFlowRecord({
      stateHash: sha256Hex(state),
      provider,
      nextPath: sanitizeNextPath(nextPath),
      nonce,
      codeVerifier: pkce.codeVerifier,
      expiresAt: new Date(Date.now() + this.config.auth.oauthFlowTtlMs)
    });

    if (provider === "google") {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", providerConfig.clientId);
      url.searchParams.set("redirect_uri", providerConfig.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);
      url.searchParams.set("code_challenge", pkce.codeChallenge);
      url.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);
      url.searchParams.set("prompt", "select_account");
      return url.toString();
    }

    const url = new URL("https://oauth.yandex.com/authorize");
    url.searchParams.set("client_id", providerConfig.clientId);
    url.searchParams.set("redirect_uri", providerConfig.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", pkce.codeChallenge);
    url.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);
    return url.toString();
  }

  async completeAuthorization(
    provider: AuthProvider,
    query: Record<string, unknown>,
    requestMeta: RequestMeta,
    existingSessionId?: string | null
  ) {
    if (!this.config.auth.providers[provider]) {
      throw new AuthError("provider_unavailable");
    }

    const providerError = typeof query.error === "string" ? query.error : null;
    if (providerError) {
      if (providerError === "access_denied") {
        throw new AuthError("access_denied");
      }
      throw new AuthError("provider_error");
    }

    const state = typeof query.state === "string" ? query.state : null;
    const code = typeof query.code === "string" ? query.code : null;
    if (!state || !code) {
      throw new AuthError("invalid_request");
    }

    const oauthFlow = await repository.consumeOAuthFlowRecord(sha256Hex(state));
    if (!oauthFlow || oauthFlow.provider !== provider) {
      throw new AuthError("invalid_state");
    }
    if (oauthFlow.expiresAt.getTime() <= Date.now()) {
      throw new AuthError("invalid_state");
    }

    const profile =
      provider === "google"
        ? await this.fetchGoogleProfile(code, oauthFlow.nonce, oauthFlow.codeVerifier)
        : await this.fetchYandexProfile(code, oauthFlow.codeVerifier);

    const user = await this.upsertUserFromProviderProfile(profile);
    const sessionId = await this.createSession(user._id.toString(), requestMeta);

    if (existingSessionId) {
      await repository.deleteSessionByHash(sha256Hex(existingSessionId));
    }

    return {
      redirectPath: oauthFlow.nextPath,
      sessionId,
      user: await this.buildPublicUser(user)
    };
  }

  async resolveRequest(
    cookieHeader: string | undefined,
    requestMeta: RequestMeta,
    options?: {
      touchSession?: boolean;
      allowCookieRefresh?: boolean;
    }
  ): Promise<SessionResolution> {
    const sessionId = this.readSessionIdFromCookieHeader(cookieHeader);
    if (!sessionId) {
      return { auth: null, clearCookie: false, refreshCookie: false };
    }

    const sessionIdHash = sha256Hex(sessionId);
    const session = await repository.findSessionByHash(sessionIdHash);
    if (!session) {
      return { auth: null, clearCookie: true, refreshCookie: false };
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await repository.deleteSessionByHash(sessionIdHash);
      return { auth: null, clearCookie: true, refreshCookie: false };
    }

    let user = await repository.findUserById(session.userId);
    if (!user) {
      await repository.deleteSessionByHash(sessionIdHash);
      return { auth: null, clearCookie: true, refreshCookie: false };
    }

    if (user.status === "blocked") {
      await repository.deleteSessionByHash(sessionIdHash);
      return { auth: null, clearCookie: true, refreshCookie: false };
    }

    const now = Date.now();
    let refreshCookie = false;

    if (options?.touchSession !== false) {
      const lastSessionTouch = new Date(session.updatedAt).getTime();
      if (now - lastSessionTouch >= this.config.auth.sessionTouchIntervalMs) {
        await repository.updateSessionRecord(sessionIdHash, {
          $set: {
            expiresAt: new Date(now + this.config.auth.sessionTtlMs),
            ip: requestMeta.ip,
            userAgent: requestMeta.userAgent
          }
        });
        refreshCookie = options?.allowCookieRefresh !== false;
      }
    }

    const lastSeenAt = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    if (now - lastSeenAt >= this.config.auth.lastSeenTouchIntervalMs) {
      const updatedUser = await repository.updateUserRecord(user._id, {
        $set: { lastSeenAt: new Date(now) }
      });
      if (updatedUser) {
        user = updatedUser;
      }
    }

    return {
      auth: {
        sessionIdHash,
        user: await this.buildPublicUser(user)
      },
      clearCookie: false,
      refreshCookie
    };
  }

  async logoutBySessionHash(sessionIdHash: string) {
    await repository.deleteSessionByHash(sessionIdHash);
  }

  async getCurrentUser(userId: string) {
    const user = await repository.findUserById(userId);
    if (!user) {
      throw new AuthError("unauthorized");
    }
    return this.buildPublicUser(user);
  }

  async updateDisplayName(userId: string, value: unknown) {
    const displayName = normalizeDisplayName(value);
    if (!displayName) {
      throw new AuthError("invalid_display_name");
    }

    const user = await repository.updateUserRecord(userId, {
      $set: { displayName }
    });

    if (!user) {
      throw new AuthError("unauthorized");
    }

    return this.buildPublicUser(user);
  }

  async replaceAvatar(userId: string, dataUrl: unknown) {
    const parsed = validateImageDataUrl(dataUrl);
    if (!parsed) {
      throw new AuthError("invalid_avatar");
    }

    await repository.upsertAvatar(userId, parsed.dataUrl);
    return this.getCurrentUser(userId);
  }

  async getAvatarPayload(userId: string) {
    const avatar = await repository.findAvatarByUserId(userId);
    if (!avatar) {
      throw new AuthError("not_found");
    }

    const parsed = validateImageDataUrl(avatar.dataUrl);
    if (!parsed) {
      throw new AuthError("invalid_avatar");
    }

    return parsed;
  }

  private async createSession(userId: string, requestMeta: RequestMeta) {
    const sessionId = createRandomToken(48);
    await repository.createSessionRecord({
      sessionIdHash: sha256Hex(sessionId),
      userId,
      expiresAt: new Date(Date.now() + this.config.auth.sessionTtlMs),
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent
    });
    return sessionId;
  }

  private async buildPublicUser(user: repository.StoredUserRecord): Promise<PublicAuthUser> {
    const avatar = await repository.findAvatarByUserId(user._id);

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
      providers: (user.providers ?? []).map((provider) => ({
        provider: provider.provider,
        linkedAt: new Date(provider.linkedAt).toISOString()
      })),
      lastSeenAt: new Date(user.lastSeenAt).toISOString(),
      lastLoginAt: new Date(user.lastLoginAt).toISOString(),
      avatarUrl: avatar ? buildAvatarUrl(user._id.toString(), avatar.updatedAt) : null
    };
  }

  private async upsertUserFromProviderProfile(profile: OAuthProviderProfile) {
    const now = new Date();
    const userByProvider = await repository.findUserByProvider(
      profile.provider,
      profile.providerUserId
    );

    if (userByProvider) {
      if (userByProvider.status === "blocked") {
        throw new AuthError("blocked");
      }

      const emailOwner = await repository.findUserByEmail(profile.email);
      if (emailOwner && emailOwner._id.toString() !== userByProvider._id.toString()) {
        console.warn("Suspicious provider conflict on login", {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email
        });
        throw new AuthError("identity_conflict");
      }

      const updated = await repository.updateUserRecord(userByProvider._id, {
        $set: {
          email: profile.email,
          emailVerified: profile.emailVerified,
          lastLoginAt: now,
          providers: (userByProvider.providers ?? []).map((item) => {
            if (
              item.provider === profile.provider &&
              item.providerUserId === profile.providerUserId
            ) {
              return {
                ...item,
                profileMeta: profile.profileMeta
              };
            }
            return item;
          })
        }
      });

      if (!updated) {
        throw new AuthError("provider_error");
      }

      return updated;
    }

    const userByEmail = await repository.findUserByEmail(profile.email);
    if (userByEmail) {
      if (userByEmail.status === "blocked") {
        throw new AuthError("blocked");
      }

      const conflictingProvider = (userByEmail.providers ?? []).find(
        (item) =>
          item.provider === profile.provider &&
          item.providerUserId !== profile.providerUserId
      );

      if (conflictingProvider) {
        console.warn("Suspicious email/provider conflict on login", {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email
        });
        throw new AuthError("identity_conflict");
      }

      const hasLinkedProvider = (userByEmail.providers ?? []).some(
        (item) =>
          item.provider === profile.provider &&
          item.providerUserId === profile.providerUserId
      );

      const nextProviders = hasLinkedProvider
        ? (userByEmail.providers ?? []).map((item) => {
            if (
              item.provider === profile.provider &&
              item.providerUserId === profile.providerUserId
            ) {
              return {
                ...item,
                profileMeta: profile.profileMeta
              };
            }
            return item;
          })
        : [
            ...(userByEmail.providers ?? []),
            {
              provider: profile.provider,
              providerUserId: profile.providerUserId,
              emailAtLink: profile.email,
              linkedAt: now,
              profileMeta: profile.profileMeta
            }
          ];

      const updated = await repository.updateUserRecord(userByEmail._id, {
        $set: {
          email: profile.email,
          emailVerified: userByEmail.emailVerified || profile.emailVerified,
          lastLoginAt: now,
          providers: nextProviders
        }
      });

      if (!updated) {
        throw new AuthError("provider_error");
      }

      return updated;
    }

    return repository.createUserRecord({
      email: profile.email,
      emailVerified: profile.emailVerified,
      displayName: createInitialDisplayName(profile.email),
      role: "player",
      status: "active",
      providers: [
        {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          emailAtLink: profile.email,
          linkedAt: now,
          profileMeta: profile.profileMeta
        }
      ],
      lastLoginAt: now,
      lastSeenAt: now
    });
  }

  private async fetchGoogleProfile(
    code: string,
    expectedNonce: string,
    codeVerifier: string
  ): Promise<OAuthProviderProfile> {
    const providerConfig = this.config.auth.providers.google;
    if (!providerConfig) {
      throw new AuthError("provider_unavailable");
    }

    const tokenPayload = await this.postForm<GoogleTokenResponse>(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: providerConfig.redirectUri
      })
    );

    if (
      !tokenPayload?.access_token ||
      typeof tokenPayload.access_token !== "string" ||
      !tokenPayload.id_token ||
      typeof tokenPayload.id_token !== "string"
    ) {
      throw new AuthError("provider_error");
    }

    const idTokenPayload = decodeJwtPayload(tokenPayload.id_token);
    if (
      typeof idTokenPayload.aud !== "string" ||
      idTokenPayload.aud !== providerConfig.clientId
    ) {
      throw new AuthError("provider_error");
    }
    if (!isGoogleIssuer(idTokenPayload.iss)) {
      throw new AuthError("provider_error");
    }
    if (typeof idTokenPayload.nonce !== "string" || idTokenPayload.nonce !== expectedNonce) {
      throw new AuthError("invalid_state");
    }
    if (
      typeof idTokenPayload.exp !== "number" ||
      idTokenPayload.exp * 1000 <= Date.now()
    ) {
      throw new AuthError("provider_error");
    }

    const userInfo = await this.getJson<GoogleUserInfoResponse>(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        Authorization: `Bearer ${tokenPayload.access_token}`
      }
    );

    const subject =
      typeof userInfo?.sub === "string"
        ? userInfo.sub
        : typeof idTokenPayload.sub === "string"
          ? idTokenPayload.sub
          : null;

    if (!subject) {
      throw new AuthError("provider_error");
    }
    if (
      typeof userInfo?.sub === "string" &&
      typeof idTokenPayload.sub === "string" &&
      userInfo.sub !== idTokenPayload.sub
    ) {
      throw new AuthError("provider_error");
    }

    const email = normalizeEmail(userInfo?.email ?? idTokenPayload.email);
    if (!email) {
      throw new AuthError("missing_email");
    }

    const emailVerified =
      userInfo?.email_verified === true || idTokenPayload.email_verified === true;
    if (!emailVerified) {
      throw new AuthError("email_not_verified");
    }

    return {
      provider: "google",
      providerUserId: subject,
      email,
      emailVerified: true,
      profileMeta: {
        email,
        name:
          typeof userInfo?.name === "string"
            ? userInfo.name
            : typeof idTokenPayload.name === "string"
              ? idTokenPayload.name
              : undefined,
        pictureUrl:
          typeof userInfo?.picture === "string"
            ? userInfo.picture
            : typeof idTokenPayload.picture === "string"
              ? idTokenPayload.picture
              : undefined,
        locale:
          typeof userInfo?.locale === "string"
            ? userInfo.locale
            : typeof idTokenPayload.locale === "string"
              ? idTokenPayload.locale
              : undefined
      }
    };
  }

  private async fetchYandexProfile(
    code: string,
    codeVerifier: string
  ): Promise<OAuthProviderProfile> {
    const providerConfig = this.config.auth.providers.yandex;
    if (!providerConfig) {
      throw new AuthError("provider_unavailable");
    }

    const tokenPayload = await this.postForm<YandexTokenResponse>(
      "https://oauth.yandex.com/token",
      new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: providerConfig.redirectUri
      })
    );

    if (!tokenPayload?.access_token || typeof tokenPayload.access_token !== "string") {
      throw new AuthError("provider_error");
    }

    const userInfo = await this.getJson<YandexUserInfoResponse>(
      "https://login.yandex.ru/info?format=json",
      {
        Authorization: `OAuth ${tokenPayload.access_token}`
      }
    );

    const providerUserId =
      userInfo?.id != null ? String(userInfo.id).trim() : "";
    if (!providerUserId) {
      throw new AuthError("provider_error");
    }

    const email = normalizeEmail(userInfo?.default_email);
    if (!email) {
      throw new AuthError("missing_email");
    }

    return {
      provider: "yandex",
      providerUserId,
      email,
      emailVerified: true,
      profileMeta: {
        email,
        name:
          typeof userInfo?.display_name === "string"
            ? userInfo.display_name
            : typeof userInfo?.real_name === "string"
              ? userInfo.real_name
              : typeof userInfo?.login === "string"
                ? userInfo.login
                : undefined,
        login: typeof userInfo?.login === "string" ? userInfo.login : undefined,
        defaultAvatarId:
          typeof userInfo?.default_avatar_id === "string"
            ? userInfo.default_avatar_id
            : undefined,
        realName:
          typeof userInfo?.real_name === "string" ? userInfo.real_name : undefined
      }
    };
  }

  private async postForm<T>(url: string, body: URLSearchParams) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const payload = await readJsonResponse<T>(response);
    if (!response.ok) {
      console.error("OAuth provider form request failed", {
        url,
        status: response.status,
        payload
      });
      throw new AuthError("provider_error");
    }

    if (!payload) {
      throw new AuthError("provider_error");
    }

    return payload;
  }

  private async getJson<T>(url: string, headers?: HeadersInit) {
    const response = await fetch(url, { headers });
    const payload = await readJsonResponse<T>(response);

    if (!response.ok || !payload) {
      console.error("OAuth provider JSON request failed", {
        url,
        status: response.status,
        payload
      });
      throw new AuthError("provider_error");
    }

    return payload;
  }
}

export function createAuthService(config?: AppConfig) {
  return new AuthService(config ?? getAppConfig());
}
