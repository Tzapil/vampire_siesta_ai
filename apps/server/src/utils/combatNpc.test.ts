import assert from "node:assert/strict";
import test from "node:test";
import {
  createCombatNpcSnapshot,
  getNextNpcCopyOrdinal,
  normalizeCombatNpcPatch
} from "./combatNpc";

test("createCombatNpcSnapshot captures independent snapshot state", () => {
  const npc = {
    _id: "npc-1",
    meta: {
      name: "Бандит",
      avatarUrl: "https://example.com/bandit.png",
      clanKey: "brujah",
      sectKey: "camarilla",
      generation: 11
    },
    traits: {
      attributes: {
        dexterity: 3,
        wits: 2
      }
    },
    resources: {
      health: {
        bashing: 1,
        lethal: 0,
        aggravated: 0
      }
    }
  };

  const snapshot = createCombatNpcSnapshot(npc, 2);
  npc.meta.name = "Изменён";
  npc.resources.health.bashing = 6;

  assert.deepEqual(snapshot, {
    npcId: "npc-1",
    baseName: "Бандит",
    displayName: "Бандит #2",
    copyOrdinal: 2,
    avatarUrl: "https://example.com/bandit.png",
    clanKey: "brujah",
    sectKey: "camarilla",
    generation: 11,
    dexterity: 3,
    wits: 2,
    health: {
      bashing: 1,
      lethal: 0,
      aggravated: 0
    },
    dead: false
  });
});

test("getNextNpcCopyOrdinal keeps monotonic numbering for objects and maps", () => {
  assert.equal(getNextNpcCopyOrdinal({ "npc-1": 2 }, "npc-1"), 3);
  assert.equal(getNextNpcCopyOrdinal(new Map([["npc-2", 4]]), "npc-2"), 5);
  assert.equal(getNextNpcCopyOrdinal({}, "npc-3"), 1);
});

test("normalizeCombatNpcPatch accepts supported fields", () => {
  const payload = normalizeCombatNpcPatch({
    dead: true,
    health: { bashing: 1, lethal: 2, aggravated: 0 },
    initiative: {
      dexterity: 3,
      wits: 2,
      base: 5,
      roll: 7,
      total: 12
    }
  });

  assert.deepEqual(payload.errors, []);
  assert.deepEqual(payload.value, {
    dead: true,
    health: { bashing: 1, lethal: 2, aggravated: 0 },
    initiative: {
      dexterity: 3,
      wits: 2,
      base: 5,
      roll: 7,
      total: 12
    }
  });
});

test("normalizeCombatNpcPatch rejects empty and malformed payloads", () => {
  const payload = normalizeCombatNpcPatch({
    health: { bashing: 8, lethal: 0, aggravated: 0 }
  });

  assert.equal(payload.errors.length > 0, true);
  assert.equal(
    payload.errors.some((issue) => issue.path === "health.bashing"),
    true
  );
});
