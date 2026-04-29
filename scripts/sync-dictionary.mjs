import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function buildDictionaryUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  return trimmed.endsWith("/v1")
    ? `${trimmed}/decks/dictionary`
    : `${trimmed}/v1/decks/dictionary`;
}

const baseUrl = parseArg("base-url") ?? process.env.DECK_HASH_API_BASE_URL ?? "https://poneglyph.one";
const outputPath = parseArg("out")
  ?? resolve(import.meta.dirname, "..", "src", "data", "dictionary.json");

const response = await fetch(buildDictionaryUrl(baseUrl));
if (!response.ok) {
  throw new Error(`Failed to fetch deck dictionary: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
if (!Array.isArray(payload.data) || payload.data.some((value) => typeof value !== "string")) {
  throw new Error("Deck dictionary response did not contain a string array");
}

const snapshot = {
  cards: payload.data,
  etag: response.headers.get("etag"),
  fetchedAt: new Date().toISOString(),
  source: buildDictionaryUrl(baseUrl),
};

mkdirSync(resolve(outputPath, ".."), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

