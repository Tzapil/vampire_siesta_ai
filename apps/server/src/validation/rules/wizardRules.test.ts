import test from "node:test";
import assert from "node:assert/strict";
import {
  computeFlawFreebie,
  validateStep1,
  validateStep7,
  validateStep8
} from "./wizardRules";
import { createCharacterFixture, createDictionariesFixture } from "../testFixtures";

test("computeFlawFreebie applies flaw cap", () => {
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();
  character.traits.flaws = ["enemy", "darkSecret", "preyExclusion"];

  assert.equal(computeFlawFreebie(character, dict), 7);
});

test("validateStep1 uses external chronicle existence check", async () => {
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();

  const issues = await validateStep1(character, dict, {
    chronicleExists: async () => false
  });

  assert.equal(issues.some((item) => item.code === "wizard.step1.meta.chronicle.not_found"), true);
});

test("validateStep7 rejects duplicate merits", () => {
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();
  character.traits.merits = ["ironWill", "ironWill"];

  const issues = validateStep7(character, dict);
  assert.equal(issues.some((item) => item.code === "wizard.step7.merits.duplicate"), true);
});

test("validateStep8 returns overspent freebie error", () => {
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();

  character.traits.attributes.strength.freebie = 5;
  character.traits.attributes.dexterity.freebie = 5;
  character.traits.attributes.stamina.freebie = 5;
  character.traits.merits = ["ironWill"];

  const issues = validateStep8(character, dict, { mutate: false });
  assert.equal(issues.some((item) => item.code === "wizard.step8.freebies.overspent"), true);
});
