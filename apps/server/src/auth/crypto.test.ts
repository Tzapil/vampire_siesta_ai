import assert from "node:assert/strict";
import test from "node:test";
import { createPkcePair, decodeJwtPayload, sha256Hex } from "./crypto";

test("createPkcePair produces verifier and S256 challenge", () => {
  const pair = createPkcePair();

  assert.equal(pair.codeChallengeMethod, "S256");
  assert.equal(typeof pair.codeVerifier, "string");
  assert.equal(typeof pair.codeChallenge, "string");
  assert.equal(pair.codeVerifier.length > 20, true);
  assert.equal(pair.codeChallenge.length > 20, true);
});

test("sha256Hex is deterministic", () => {
  assert.equal(
    sha256Hex("session-token"),
    "c101e911469c969171040b50d70543313cf968fdef5bacc780776f8fb399ab36"
  );
});

test("decodeJwtPayload parses base64url payload", () => {
  const token =
    "header.eyJzdWIiOiIxMjMiLCJub25jZSI6Inh5eiIsImV4cCI6MTc4MDAwMDAwMH0.signature";

  assert.deepEqual(decodeJwtPayload(token), {
    sub: "123",
    nonce: "xyz",
    exp: 1780000000
  });
});
