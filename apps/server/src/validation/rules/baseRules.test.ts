import test from "node:test";
import assert from "node:assert/strict";
import { validateRanges } from "./baseRules";
import { createCharacterFixture, createDictionariesFixture } from "../testFixtures";

test("validateRanges rejects non-clan discipline in wizard mode", () => {
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();

  character.meta.clanKey = "ventrue";
  character.traits.disciplines.dominate.base = 1;
  character.traits.disciplines.animalism.base = 1;

  const issues = validateRanges(character, dict, { allowNonClanDisciplines: false });
  const hasNonClanIssue = issues.some((item) => item.code === "range.disciplines.non_clan");
  assert.equal(hasNonClanIssue, true);
});

test("validateRanges rejects health overflow", () => {
  const dict = createDictionariesFixture();
  const character = createCharacterFixture();

  character.resources.health = { bashing: 3, lethal: 3, aggravated: 2 };

  const issues = validateRanges(character, dict, { allowNonClanDisciplines: true });
  const hasOverflowIssue = issues.some((item) => item.code === "range.resources.health.total");
  assert.equal(hasOverflowIssue, true);
});
