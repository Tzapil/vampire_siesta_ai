import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeCharacterForChronicleImport,
  sanitizeCharacterForExport
} from "./characterTransfer";

test("sanitizeCharacterForExport strips ownership fields, player name and chronicle link", () => {
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
      chronicleId: "chronicle-1",
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

test("sanitizeCharacterForChronicleImport replaces identity, ownership and chronicle fields", () => {
  const payload = sanitizeCharacterForChronicleImport(
    {
      uuid: "exported-character",
      _id: "mongo-id",
      id: "virtual-id",
      __v: 4,
      version: 9,
      createdByUserId: "export-owner",
      createdByDisplayName: "Export Owner",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      deleted: true,
      deletedAt: "2024-01-03T00:00:00.000Z",
      creationFinished: true,
      meta: {
        name: "Lucita",
        playerName: "Export Owner",
        chronicleId: "export-chronicle",
        clanKey: "lasombra"
      }
    },
    {
      uuid: "new-character",
      chronicleId: "target-chronicle",
      createdByUserId: "current-user",
      createdByDisplayName: "Current User",
      playerName: "Current User"
    }
  );

  assert.deepEqual(payload, {
    uuid: "new-character",
    createdByUserId: "current-user",
    createdByDisplayName: "Current User",
    deleted: false,
    creationFinished: true,
    meta: {
      name: "Lucita",
      clanKey: "lasombra",
      playerName: "Current User",
      chronicleId: "target-chronicle"
    }
  });
});
