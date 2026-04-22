import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAvatarUrl,
  buildLoginRedirectPath,
  createInitialDisplayName,
  normalizeDisplayName,
  normalizeEmail,
  sanitizeNextPath,
  validateImageDataUrl
} from "./utils";

test("normalizeEmail trims and lowercases email", () => {
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(normalizeEmail("   "), null);
});

test("normalizeDisplayName enforces trim and length", () => {
  assert.equal(normalizeDisplayName("  Prince   Lucien  "), "Prince Lucien");
  assert.equal(normalizeDisplayName("A"), null);
  assert.equal(normalizeDisplayName(" ".repeat(10)), null);
});

test("sanitizeNextPath keeps only relative in-app paths", () => {
  assert.equal(sanitizeNextPath("/chronicles/42?tab=notes"), "/chronicles/42?tab=notes");
  assert.equal(sanitizeNextPath("https://evil.example.com"), "/");
  assert.equal(sanitizeNextPath("//evil.example.com"), "/");
});

test("buildLoginRedirectPath adds safe next only when needed", () => {
  assert.equal(buildLoginRedirectPath("invalid_state"), "/auth/login?error=invalid_state");
  assert.equal(
    buildLoginRedirectPath("invalid_state", "/chronicles/42"),
    "/auth/login?error=invalid_state&next=%2Fchronicles%2F42"
  );
});

test("createInitialDisplayName falls back for short local parts", () => {
  assert.equal(createInitialDisplayName("alice@example.com"), "alice");
  assert.equal(createInitialDisplayName("x@example.com"), "x_");
});

test("validateImageDataUrl accepts valid image data urls", () => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9V4AAAAASUVORK5CYII=";

  const parsed = validateImageDataUrl(dataUrl);
  assert.ok(parsed);
  assert.equal(parsed?.mimeType, "image/png");
  assert.equal(parsed?.buffer.length > 0, true);
});

test("buildAvatarUrl appends cache-busting timestamp", () => {
  const url = buildAvatarUrl("user-1", new Date("2026-04-22T10:00:00.000Z"));
  assert.equal(url, "/api/auth/avatar/user-1?v=1776852000000");
});
