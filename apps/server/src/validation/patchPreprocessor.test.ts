import test from "node:test";
import assert from "node:assert/strict";
import { parseTraitPatchPath, preprocessPatch } from "./patchPreprocessor";

test("preprocessPatch fails fast on malformed patch", () => {
  const result = preprocessPatch({ op: "replace" }, false);
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("expected validation failure");
  }
  assert.equal(result.issues[0].code, "patch.op.invalid");
});

test("preprocessPatch rejects disallowed paths", () => {
  const result = preprocessPatch(
    {
      op: "set",
      characterUuid: "uuid-1",
      baseVersion: 1,
      path: "meta.deleted",
      value: true
    },
    false
  );
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("expected validation failure");
  }
  assert.equal(result.issues[0].code, "patch.path.disallowed");
});

test("parseTraitPatchPath extracts trait patch descriptor", () => {
  const parsed = parseTraitPatchPath("traits.attributes.strength.base");
  assert.deepEqual(parsed, {
    group: "attributes",
    key: "strength",
    layerName: "base"
  });
});
