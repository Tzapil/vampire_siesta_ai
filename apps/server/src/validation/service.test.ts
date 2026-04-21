import test from "node:test";
import assert from "node:assert/strict";
import { CharacterValidationService } from "./service";
import { CachedDictionaryProvider } from "./dictionaryProvider";
import { createCharacterFixture, createDictionariesFixture } from "./testFixtures";

function createService() {
  const provider = new CachedDictionaryProvider(async () => createDictionariesFixture());
  return new CharacterValidationService(provider);
}

test("validatePatchStructure fail-fast rejects malformed patch", async () => {
  const service = createService();
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();

  const result = await service.validatePatchStructure({
    patch: { op: "replace", characterUuid: "uuid-1", baseVersion: 1, path: "meta.name", value: "x" },
    character,
    dictionaries: dict
  });

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, "patch.op.invalid");
});

test("validatePatchStructure collects structural issues for trait patch", async () => {
  const service = createService();
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();

  const result = await service.validatePatchStructure({
    patch: {
      op: "set",
      characterUuid: "uuid-1",
      baseVersion: 1,
      path: "traits.attributes.strength.base",
      value: 9
    },
    character,
    dictionaries: dict
  });

  assert.equal(result.issues.some((item) => item.code === "patch.attributes.base.invalid"), true);
});
