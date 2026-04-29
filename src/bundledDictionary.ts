import dictionarySnapshot from "./data/dictionary.json" with { type: "json" };
import { createDeckHashDictionary } from "./dictionary.js";
import type { DeckHashDictionary, DeckHashDictionarySnapshot } from "./types.js";

const bundledSnapshot = dictionarySnapshot as DeckHashDictionarySnapshot;
const bundledDictionary = createDeckHashDictionary(bundledSnapshot);

export function getBundledDeckHashDictionary(): DeckHashDictionary {
  return bundledDictionary;
}

export function getBundledDeckHashDictionarySnapshot(): DeckHashDictionarySnapshot {
  return bundledSnapshot;
}

