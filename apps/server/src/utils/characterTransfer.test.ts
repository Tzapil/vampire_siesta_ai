import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCharacterForExport } from "./characterTransfer";

test("sanitizeCharacterForExport strips ownership fields and player name", () => {
  const payload = sanitizeCharacterForExport({
    uuid: "character-1",
    _id: "mongo-id",
    __v: 4,
    createdByUserId: "user-1",
    createdByDisplayName: "Player One",
    creationFinished: true,
    meta: {
      name: "Lucita",
      playerName: "Player One",
      clanKey: "lasombra"
    }
  });

  assert.deepEqual(payload, {
    creationFinished: true,
    meta: {
      name: "Lucita",
      clanKey: "lasombra"
    }
  });
});
