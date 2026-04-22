const DEFAULT_AVATAR_MAX_LENGTH = 5_000_000;

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 40) {
    return null;
  }
  return normalized;
}

export function createInitialDisplayName(email: string) {
  const localPart = email.split("@")[0]?.trim() || "";
  if (localPart.length >= 2) {
    return localPart.slice(0, 40);
  }
  if (localPart.length === 1) {
    return `${localPart}_`;
  }
  return "player";
}

export function sanitizeNextPath(value: unknown) {
  if (typeof value !== "string") return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function buildLoginRedirectPath(errorCode: string, nextPath?: string) {
  const params = new URLSearchParams();
  params.set("error", errorCode);

  const safeNext = sanitizeNextPath(nextPath);
  if (safeNext !== "/") {
    params.set("next", safeNext);
  }

  return `/auth/login?${params.toString()}`;
}

export function buildAvatarUrl(userId: string, updatedAt: Date | string) {
  const version =
    updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  return `/api/auth/avatar/${encodeURIComponent(userId)}?v=${version}`;
}

export function validateImageDataUrl(
  value: unknown,
  maxLength = DEFAULT_AVATAR_MAX_LENGTH
) {
  if (typeof value !== "string") {
    return null;
  }

  const dataUrl = value.trim();
  if (!dataUrl.startsWith("data:image/") || dataUrl.length > maxLength) {
    return null;
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }

  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0) {
      return null;
    }
    return {
      dataUrl,
      mimeType: match[1],
      buffer
    };
  } catch {
    return null;
  }
}
