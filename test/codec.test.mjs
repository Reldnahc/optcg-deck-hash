import assert from "node:assert/strict";

import {
  createApiDeckHashDictionarySource,
  createDeckHashCodec,
  decodeDeckHash,
  encodeDeckHash,
  fetchDeckDictionary,
  getBundledDeckHashDictionary,
  UnknownDeckHashDictionaryIdError,
} from "../dist/index.js";

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

await run("top-level bundled codec roundtrips a deck", async () => {
  const hash = await encodeDeckHash({
    leader: { card_number: "OP01-001", count: 1 },
    main: [
      { card_number: "OP01-006", count: 4 },
      { card_number: "OP01-016", count: 4 },
      { card_number: "OP01-017", count: 2, variant_index: 3 },
    ],
    don: null,
    format: "standard",
  });
  assert.equal(hash, "eJybILeg3dxN7JmbuJqDGfvFTgMBIwBC3wYb");

  const deck = await decodeDeckHash(hash);

  assert.deepEqual(deck, {
    leader: { card_number: "OP01-001", count: 1 },
    main: [
      { card_number: "OP01-006", count: 4 },
      { card_number: "OP01-016", count: 4 },
      { card_number: "OP01-017", count: 2, variant_index: 3 },
    ],
    don: null,
    format: "standard",
  });
});

await run("encode uses raw card fallback without calling the dictionary source", async () => {
  let sourceCalls = 0;
  const codec = createDeckHashCodec({
    dictionarySource: {
      async loadDictionary(current) {
        sourceCalls += 1;
        return current;
      },
    },
  });

  const hash = await codec.encode({
    leader: null,
    main: [{ card_number: "ZZ99-999", count: 4 }],
    don: null,
  });

  const decoded = await codec.decode(hash);

  assert.equal(sourceCalls, 0);
  assert.deepEqual(decoded, {
    leader: null,
    main: [{ card_number: "ZZ99-999", count: 4 }],
    don: null,
  });
});

await run("decode refreshes once on unknown dictionary id when a source is configured", async () => {
  const initialDictionary = ["OP01-001"];
  const refreshedDictionary = ["OP01-001", "OP99-999"];
  let refreshCalls = 0;

  const encodingCodec = createDeckHashCodec({ dictionary: refreshedDictionary });
  const decodingCodec = createDeckHashCodec({
    dictionary: initialDictionary,
    dictionarySource: {
      async loadDictionary() {
        refreshCalls += 1;
        return refreshedDictionary;
      },
    },
  });

  const hash = await encodingCodec.encode({
    leader: { card_number: "OP99-999", count: 1 },
    main: [],
    don: null,
  }, { compression: "raw" });

  const deck = await decodingCodec.decode(hash);

  assert.equal(refreshCalls, 1);
  assert.deepEqual(deck, {
    leader: { card_number: "OP99-999", count: 1 },
    main: [],
    don: null,
  });
});

await run("decode throws unknown dictionary id when no source is configured", async () => {
  const encodingCodec = createDeckHashCodec({
    dictionary: ["OP01-001", "OP99-999"],
  });
  const decodingCodec = createDeckHashCodec({
    dictionary: ["OP01-001"],
  });

  const hash = await encodingCodec.encode({
    leader: { card_number: "OP99-999", count: 1 },
    main: [],
    don: null,
  }, { compression: "raw" });

  await assert.rejects(
    () => decodingCodec.decode(hash),
    (error) => error instanceof UnknownDeckHashDictionaryIdError && error.cardId === 1,
  );
});

await run("fetchDeckDictionary parses the API envelope and ETag", async () => {
  const result = await fetchDeckDictionary({
    baseUrl: "https://poneglyph.one",
    fetch: async () => new Response(
      JSON.stringify({ data: ["OP01-001", "OP01-006"] }),
      {
        status: 200,
        headers: { ETag: "\"dict-2\"" },
      },
    ),
  });

  assert.equal(result.notModified, false);
  assert.equal(result.etag, "\"dict-2\"");
  assert.deepEqual(result.dictionary?.cards, ["OP01-001", "OP01-006"]);
});

await run("api dictionary source reuses the current dictionary on 304", async () => {
  const bundled = getBundledDeckHashDictionary();
  const source = createApiDeckHashDictionarySource({
    baseUrl: "https://poneglyph.one",
    fetch: async () => new Response(null, { status: 304 }),
  });

  const next = await source.loadDictionary(bundled);
  assert.strictEqual(next, bundled);
});
