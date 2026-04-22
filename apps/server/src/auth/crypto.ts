import { createHash, randomBytes } from "node:crypto";

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

export function createRandomToken(size = 32) {
  return toBase64Url(randomBytes(size));
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPkcePair() {
  const codeVerifier = createRandomToken(48);
  const codeChallenge = toBase64Url(
    createHash("sha256").update(codeVerifier).digest()
  );

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256" as const
  };
}

export function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Некорректный JWT");
  }

  const payload = fromBase64Url(parts[1]).toString("utf8");
  return JSON.parse(payload) as Record<string, unknown>;
}
