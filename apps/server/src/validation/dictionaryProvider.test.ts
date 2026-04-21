import test from "node:test";
import assert from "node:assert/strict";
import { CachedDictionaryProvider } from "./dictionaryProvider";
import { createDictionariesFixture } from "./testFixtures";

test("CachedDictionaryProvider caches loader result inside TTL", async () => {
  let now = 0;
  let calls = 0;
  const provider = new CachedDictionaryProvider(
    async () => {
      calls += 1;
      return createDictionariesFixture();
    },
    100,
    () => now
  );

  await provider.getDictionaries();
  await provider.getDictionaries();
  assert.equal(calls, 1);
  assert.equal(provider.getCacheStats().hits, 1);
  assert.equal(provider.getCacheStats().misses, 1);

  now = 101;
  await provider.getDictionaries();
  assert.equal(calls, 2);
  assert.equal(provider.getCacheStats().misses, 2);
});

test("CachedDictionaryProvider invalidates cache explicitly", async () => {
  let calls = 0;
  const provider = new CachedDictionaryProvider(async () => {
    calls += 1;
    return createDictionariesFixture();
  });

  await provider.getDictionaries();
  provider.invalidateCache();
  await provider.getDictionaries();

  assert.equal(calls, 2);
});
