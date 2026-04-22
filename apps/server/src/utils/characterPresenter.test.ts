import assert from "node:assert/strict";
import test from "node:test";
import { presentCharacterPlayerName } from "./characterPresenter";

test("presentCharacterPlayerName prefers current creator display name", () => {
  const character = presentCharacterPlayerName(
    {
      createdByDisplayName: "Old Name",
      meta: {
        playerName: "Stale Name"
      }
    },
    "Current Name"
  );

  assert.equal(character.createdByDisplayName, "Current Name");
  assert.equal(character.meta?.playerName, "Current Name");
});

test("presentCharacterPlayerName falls back to stored creator display name", () => {
  const character = presentCharacterPlayerName({
    createdByDisplayName: "Stored Creator",
    meta: {
      playerName: ""
    }
  });

  assert.equal(character.meta?.playerName, "Stored Creator");
});

test("presentCharacterPlayerName falls back to legacy playerName when needed", () => {
  const character = presentCharacterPlayerName({
    meta: {
      playerName: "Legacy Player"
    }
  });

  assert.equal(character.meta?.playerName, "Legacy Player");
});
