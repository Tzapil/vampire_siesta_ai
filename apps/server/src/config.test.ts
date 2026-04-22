import assert from "node:assert/strict";
import test from "node:test";
import { buildAppConfig } from "./config";

test("buildAppConfig accepts a single configured provider", () => {
  const config = buildAppConfig({
    MONGO_URL: "mongodb://localhost:27017/siesta",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    GOOGLE_REDIRECT_URI: "http://localhost:5173/api/auth/google/callback"
  });

  assert.equal(config.port, 4000);
  assert.equal(config.auth.sessionCookieName, "vs_session");
  assert.equal(config.auth.providers.google?.clientId, "google-client");
  assert.equal(config.auth.providers.yandex, undefined);
});

test("buildAppConfig allows startup without configured providers", () => {
  const config = buildAppConfig({
    MONGO_URL: "mongodb://localhost:27017/siesta"
  });

  assert.deepEqual(config.auth.providers, {});
});

test("buildAppConfig ignores redirect-only provider placeholders", () => {
  const config = buildAppConfig({
    MONGO_URL: "mongodb://localhost:27017/siesta",
    GOOGLE_REDIRECT_URI: "http://localhost:5173/api/auth/google/callback"
  });

  assert.equal(config.auth.providers.google, undefined);
});

test("buildAppConfig rejects partially configured provider", () => {
  assert.throws(
    () =>
      buildAppConfig({
        MONGO_URL: "mongodb://localhost:27017/siesta",
        GOOGLE_CLIENT_ID: "google-client"
      }),
    /настроен частично/
  );
});

test("buildAppConfig rejects SameSite none without secure cookies", () => {
  assert.throws(
    () =>
      buildAppConfig({
        MONGO_URL: "mongodb://localhost:27017/siesta",
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GOOGLE_REDIRECT_URI: "http://localhost:5173/api/auth/google/callback",
        SESSION_SAMESITE: "none",
        SESSION_SECURE: "false"
      }),
    /SESSION_SAMESITE=none требует SESSION_SECURE=true/
  );
});
