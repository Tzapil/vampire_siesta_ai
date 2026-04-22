import path from "node:path";
import type { AuthProvider } from "./auth/types";

export type CookieSameSite = "lax" | "strict" | "none";

export type OAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type AppConfig = {
  port: number;
  mongoUrl: string;
  nodeEnv: string;
  isProd: boolean;
  clientDistPath: string;
  allowedOrigins: string[];
  auth: {
    sessionCookieName: string;
    sessionTtlDays: number;
    sessionTtlMs: number;
    sessionSecure: boolean;
    sessionSameSite: CookieSameSite;
    sessionTouchIntervalMs: number;
    lastSeenTouchIntervalMs: number;
    oauthFlowTtlMs: number;
    providers: Partial<Record<AuthProvider, OAuthProviderConfig>>;
  };
};

const DEV_DEFAULT_ORIGINS = ["http://localhost:5173"];
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const LAST_SEEN_TOUCH_INTERVAL_MS = 15 * 60 * 1000;
const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

let cachedConfig: AppConfig | null = null;

function readRequiredString(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} не задан`);
  }
  return value;
}

function readOptionalString(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  return value ? value : null;
}

function readBoolean(env: NodeJS.ProcessEnv, name: string, defaultValue: boolean) {
  const value = readOptionalString(env, name);
  if (!value) return defaultValue;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error(`${name} должен быть boolean-значением`);
}

function readPositiveInteger(env: NodeJS.ProcessEnv, name: string, defaultValue: number) {
  const value = readOptionalString(env, name);
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} должен быть положительным целым числом`);
  }
  return parsed;
}

function readAbsoluteUrl(value: string, fieldName: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} должен быть абсолютным URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${fieldName} должен использовать http или https`);
  }
  return parsed.toString();
}

function readOrigin(value: string, fieldName: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} должен быть абсолютным URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${fieldName} должен использовать http или https`);
  }
  return parsed.origin;
}

function readOriginList(env: NodeJS.ProcessEnv, nodeEnv: string) {
  const raw = readOptionalString(env, "ALLOWED_ORIGINS");
  const values =
    raw?.split(",").map((item) => item.trim()).filter(Boolean) ??
    (nodeEnv === "production" ? [] : DEV_DEFAULT_ORIGINS);

  return Array.from(
    new Set(values.map((item) => readOrigin(item, "ALLOWED_ORIGINS")))
  );
}

function readProviderConfig(
  env: NodeJS.ProcessEnv,
  provider: AuthProvider,
  prefix: "GOOGLE" | "YANDEX"
): OAuthProviderConfig | null {
  const clientId = readOptionalString(env, `${prefix}_CLIENT_ID`);
  const clientSecret = readOptionalString(env, `${prefix}_CLIENT_SECRET`);
  const redirectUri = readOptionalString(env, `${prefix}_REDIRECT_URI`);
  const hasCredentials = Boolean(clientId || clientSecret);

  // Allow keeping redirect URI placeholders in .env.example/.env without
  // treating the provider as partially configured until credentials are added.
  if (!hasCredentials) {
    return null;
  }

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      `OAuth-провайдер ${provider} настроен частично: нужны ${prefix}_CLIENT_ID, ${prefix}_CLIENT_SECRET и ${prefix}_REDIRECT_URI`
    );
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: readAbsoluteUrl(redirectUri!, `${prefix}_REDIRECT_URI`)
  };
}

function readSameSite(env: NodeJS.ProcessEnv): CookieSameSite {
  const value = readOptionalString(env, "SESSION_SAMESITE")?.toLowerCase() ?? "lax";
  if (value === "lax" || value === "strict" || value === "none") {
    return value;
  }
  throw new Error("SESSION_SAMESITE должен быть lax, strict или none");
}

export function buildAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV?.trim() || "development";
  const isProd = nodeEnv === "production";
  const sessionTtlDays = readPositiveInteger(env, "SESSION_TTL_DAYS", 7);
  const sessionCookieName =
    readOptionalString(env, "SESSION_COOKIE_NAME") ?? "vs_session";
  const sessionSameSite = readSameSite(env);
  const google = readProviderConfig(env, "google", "GOOGLE");
  const yandex = readProviderConfig(env, "yandex", "YANDEX");

  const sessionSecure = readBoolean(env, "SESSION_SECURE", isProd);
  if (sessionSameSite === "none" && !sessionSecure) {
    throw new Error("SESSION_SAMESITE=none требует SESSION_SECURE=true");
  }

  return {
    port: readPositiveInteger(env, "PORT", 4000),
    mongoUrl: readRequiredString(env, "MONGO_URL"),
    nodeEnv,
    isProd,
    clientDistPath:
      readOptionalString(env, "CLIENT_DIST_PATH") ??
      path.resolve(process.cwd(), "apps/client/dist"),
    allowedOrigins: readOriginList(env, nodeEnv),
    auth: {
      sessionCookieName,
      sessionTtlDays,
      sessionTtlMs: sessionTtlDays * 24 * 60 * 60 * 1000,
      sessionSecure,
      sessionSameSite,
      sessionTouchIntervalMs: SESSION_TOUCH_INTERVAL_MS,
      lastSeenTouchIntervalMs: LAST_SEEN_TOUCH_INTERVAL_MS,
      oauthFlowTtlMs: OAUTH_FLOW_TTL_MS,
      providers: {
        ...(google ? { google } : {}),
        ...(yandex ? { yandex } : {})
      }
    }
  };
}

export function getAppConfig() {
  if (!cachedConfig) {
    cachedConfig = buildAppConfig();
  }
  return cachedConfig;
}

export function resetAppConfigCache() {
  cachedConfig = null;
}
