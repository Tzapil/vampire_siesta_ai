import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchRegex, validateNpcHealth } from "./npcValidation";

test("buildSearchRegex matches substring case-insensitively and escapes regex tokens", () => {
  const regex = buildSearchRegex("Bandit.+");

  assert.equal(regex.test("bandit.+ captain"), true);
  assert.equal(regex.test("bandit captain"), false);
});

test("validateNpcHealth rejects overflow and out-of-range cells", () => {
  const issues: Array<{ path: string; message: string }> = [];

  const health = validateNpcHealth(
    { bashing: 9, lethal: 1, aggravated: -1 },
    "resources.health",
    issues
  );

  assert.deepEqual(health, {
    bashing: 7,
    lethal: 1,
    aggravated: 0
  });
  assert.deepEqual(
    issues.map((issue) => issue.path),
    [
      "resources.health.bashing",
      "resources.health.aggravated",
      "resources.health"
    ]
  );
});
