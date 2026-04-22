import type { CookieSameSite } from "../config";

type SerializeCookieOptions = {
  httpOnly?: boolean;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: CookieSameSite;
  secure?: boolean;
  expires?: Date;
};

export function parseCookies(header: string | undefined) {
  if (!header) return {} as Record<string, string>;

  const pairs = header.split(";").map((part) => part.trim()).filter(Boolean);
  const result: Record<string, string> = {};

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

export function serializeCookie(
  name: string,
  value: string,
  options: SerializeCookieOptions = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (typeof options.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}
