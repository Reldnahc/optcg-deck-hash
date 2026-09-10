import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import {
  createApiDeckHashDictionarySource,
  createDeckHashCodec,
  DeckHashDictionaryContractError,
  decodeDeckHash,
  encodeDeckHash,
  fetchDeckDictionary,
  getBundledDeckHashDictionary,
  UnknownDeckHashDictionaryIdError,
} from "../dist/index.js";

const op17Fixture = JSON.parse(readFileSync(new URL("./fixtures/op17-deck.json", import.meta.url), "utf8"));

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

await run("encode refreshes once for missing cards before falling back to raw strings", async () => {
  let sourceCalls = 0;
  const codec = createDeckHashCodec({
    dictionary: ["OP01-001"],
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

  assert.equal(sourceCalls, 1);
  assert.deepEqual(decoded, {
    leader: null,
    main: [{ card_number: "ZZ99-999", count: 4 }],
    don: null,
  });
});

await run("encode uses refreshed dictionary ids when the source contains missing cards", async () => {
  let sourceCalls = 0;
  const refreshedDictionary = ["OP01-001", "OP99-999"];
  const codec = createDeckHashCodec({
    dictionary: ["OP01-001"],
    dictionarySource: {
      async loadDictionary() {
        sourceCalls += 1;
        return refreshedDictionary;
      },
    },
  });

  const hash = await codec.encode({
    leader: null,
    main: [{ card_number: "OP99-999", count: 4 }],
    don: null,
  }, { compression: "raw" });

  const rawPayload = hash.slice(1);
  assert.equal(sourceCalls, 1);
  assert.equal(rawPayload.includes("OP99-999"), false);
  assert.deepEqual(await codec.decode(hash), {
    leader: null,
    main: [{ card_number: "OP99-999", count: 4 }],
    don: null,
  });
});

await run("encode chunks main deck counts above the packed entry limit", async () => {
  const codec = createDeckHashCodec({
    dictionary: ["OP01-001", "OP01-006"],
  });

  const hash = await codec.encode({
    leader: { card_number: "OP01-001", count: 1 },
    main: [{ card_number: "OP01-006", count: 18 }],
    don: null,
  }, { compression: "raw" });

  assert.deepEqual(await codec.decode(hash), {
    leader: { card_number: "OP01-001", count: 1 },
    main: [
      { card_number: "OP01-006", count: 8 },
      { card_number: "OP01-006", count: 8 },
      { card_number: "OP01-006", count: 2 },
    ],
    don: null,
  });
});

await run("encode can skip missing-card refresh when explicitly disabled", async () => {
  let sourceCalls = 0;
  const codec = createDeckHashCodec({
    dictionary: ["OP01-001"],
    dictionarySource: {
      async loadDictionary() {
        sourceCalls += 1;
        return ["OP01-001", "OP99-999"];
      },
    },
  });

  const hash = await codec.encode({
    leader: null,
    main: [{ card_number: "OP99-999", count: 4 }],
    don: null,
  }, { compression: "raw", refreshOnMissingCard: false });

  assert.equal(sourceCalls, 0);
  assert.deepEqual(await codec.decode(hash), {
    leader: null,
    main: [{ card_number: "OP99-999", count: 4 }],
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

for (const compression of ["auto", "raw"]) {
  await run(`${compression} decode refreshes unknown IDs in leader, main, and DON entries`, async () => {
    const dictionary = ["OP01-001", "OP99-999"];
    for (const slot of ["leader", "main", "don"]) {
      const entry = { card_number: "OP99-999", count: slot === "don" ? 10 : slot === "main" ? 4 : 1 };
      const deck = { leader: null, main: [], don: null, [slot]: slot === "main" ? [entry] : entry };
      const hash = await createDeckHashCodec({ dictionary }).encode(deck, { compression });
      assert.equal(hash.startsWith("!"), compression === "raw");
      let calls = 0;
      const codec = createDeckHashCodec({
        dictionary: dictionary.slice(0, 1),
        dictionarySource: { async loadDictionary() { calls += 1; return dictionary; } },
      });
      assert.deepEqual(await codec.decode(hash), deck);
      assert.equal(calls, 1);
      assert.deepEqual(await codec.decode(hash), deck);
      assert.equal(calls, 1, "the refreshed dictionary should be reused");
    }
  });
}

await run("reported OP17 hash refreshes through the API adapter and recovers the exact deck", async () => {
  let calls = 0;
  const codec = createDeckHashCodec({
    dictionary: op17Fixture.dictionary.slice(0, op17Fixture.staleDictionarySize),
    dictionarySource: createApiDeckHashDictionarySource({
      fetch: async (url) => {
        calls += 1;
        assert.equal(String(url), "https://api.poneglyph.one/v1/decks/dictionary");
        return new Response(JSON.stringify({ data: op17Fixture.dictionary }), { status: 200 });
      },
    }),
  });
  assert.deepEqual(await codec.decode(op17Fixture.hash), op17Fixture.deck);
  assert.equal(calls, 1);
  assert.equal(op17Fixture.deck.main.reduce((sum, entry) => sum + entry.count, 0), 50);
});

for (const scenario of ["no source", "refresh disabled", "unchanged dictionary", "still missing after refresh"]) {
  await run(`compressed decode preserves the unknown ID error: ${scenario}`, async () => {
    let calls = 0;
    const initial = op17Fixture.dictionary.slice(0, op17Fixture.staleDictionarySize);
    const codec = createDeckHashCodec({
      dictionary: initial,
      ...(scenario === "no source" ? {} : {
        dictionarySource: {
          async loadDictionary() {
            calls += 1;
            return scenario === "still missing after refresh"
              ? op17Fixture.dictionary.slice(0, op17Fixture.staleDictionarySize + 1)
              : initial;
          },
        },
      }),
    });
    await assert.rejects(
      () => codec.decode(op17Fixture.hash, { refreshOnUnknownDictionaryId: scenario !== "refresh disabled" }),
      (error) => error instanceof UnknownDeckHashDictionaryIdError && error.cardId === 2687,
    );
    assert.equal(calls, scenario === "no source" || scenario === "refresh disabled" ? 0 : 1);
  });
}

await run("compressed decode propagates dictionary fetch failures", async () => {
  const failure = new Error("dictionary request failed");
  let calls = 0;
  const codec = createDeckHashCodec({
    dictionary: op17Fixture.dictionary.slice(0, op17Fixture.staleDictionarySize),
    dictionarySource: { async loadDictionary() { calls += 1; throw failure; } },
  });
  await assert.rejects(() => codec.decode(op17Fixture.hash), (error) => error === failure);
  assert.equal(calls, 1);
});

await run("compressed decode rejects dictionary reordering without replacing the current dictionary", async () => {
  const initial = op17Fixture.dictionary.slice(0, op17Fixture.staleDictionarySize);
  const incompatible = [...op17Fixture.dictionary];
  [incompatible[0], incompatible[1]] = [incompatible[1], incompatible[0]];
  const codec = createDeckHashCodec({
    dictionary: initial,
    dictionarySource: { async loadDictionary() { return incompatible; } },
  });
  await assert.rejects(() => codec.decode(op17Fixture.hash), DeckHashDictionaryContractError);
  assert.deepEqual(codec.getDictionary().cards, initial);
});

await run("compressed parsing errors are preserved without dictionary refresh or raw reinterpretation", async () => {
  let calls = 0;
  const codec = createDeckHashCodec({
    dictionary: [],
    dictionarySource: { async loadDictionary() { calls += 1; return []; } },
  });
  // No leader/DON/name/format, one main entry, delta mode without a preceding absolute ID.
  const hash = deflateSync(Buffer.from([0x00, 0x10, 0x00])).toString("base64url");
  await assert.rejects(() => codec.decode(hash), { message: "Missing base dictionary id for delta entry" });
  assert.equal(calls, 0);
});

await run("unprefixed raw hashes retain their legacy fallback", async () => {
  const codec = createDeckHashCodec({ dictionary: ["OP01-001", "OP99-999"] });
  const expected = { leader: { card_number: "OP99-999", count: 1 }, main: [], don: null };
  assert.deepEqual(await codec.decode("gAAgAA"), expected);
  assert.deepEqual(await codec.decode("!gAAgAA"), expected);
});

await run("historical d3/d4/d5/d5r hashes remain readable", async () => {
  const codec = createDeckHashCodec({ dictionary: ["OP99-999", "OP01-001"] });
  const expected = { leader: { card_number: "OP01-001", count: 1 }, main: [], don: null };
  for (const hash of ["d3.gIIAgAA", "d4.eJxraGJoYAAABY0Bgw", "d5r.gAgA", "d5.eJxr4GAAAAGTAIk"]) {
    assert.deepEqual(await codec.decode(hash), expected, hash);
  }
});

await run("fetchDeckDictionary parses the API envelope and ETag", async () => {
  const result = await fetchDeckDictionary({
    baseUrl: "https://api.poneglyph.one",
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

await run("api dictionary source defaults to the production API origin", async () => {
  const bundled = getBundledDeckHashDictionary();
  let requestedUrl = "";
  const source = createApiDeckHashDictionarySource({
    fetch: async (url) => {
      requestedUrl = String(url);
      return new Response(null, { status: 304 });
    },
  });

  const next = await source.loadDictionary(bundled);
  assert.strictEqual(next, bundled);
  assert.equal(requestedUrl, "https://api.poneglyph.one/v1/decks/dictionary");
});

await run("api dictionary source reuses the current dictionary on 304", async () => {
  const bundled = getBundledDeckHashDictionary();
  const source = createApiDeckHashDictionarySource({
    baseUrl: "https://api.poneglyph.one",
    fetch: async () => new Response(null, { status: 304 }),
  });

  const next = await source.loadDictionary(bundled);
  assert.strictEqual(next, bundled);
});
