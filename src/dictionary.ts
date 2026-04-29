import { DeckHashDictionaryContractError } from "./errors.js";
import type {
  DeckHashDictionary,
  DeckHashDictionaryInput,
  DeckHashDictionarySnapshot,
} from "./types.js";

export function createDeckHashDictionary(input: DeckHashDictionaryInput): DeckHashDictionary {
  if (isDeckHashDictionary(input)) {
    return input;
  }

  let snapshot: DeckHashDictionarySnapshot;
  if (Array.isArray(input)) {
    snapshot = { cards: [...input] };
  } else {
    snapshot = input as DeckHashDictionarySnapshot;
  }

  const cards = snapshot.cards.map((value, index) => normalizeCardNumber(value, index));
  const indexByCardNumber = new Map<string, number>();

  cards.forEach((cardNumber, index) => {
    if (indexByCardNumber.has(cardNumber)) {
      throw new DeckHashDictionaryContractError(`Duplicate card number in dictionary: ${cardNumber}`);
    }
    indexByCardNumber.set(cardNumber, index);
  });

  return {
    cards: Object.freeze(cards),
    indexByCardNumber,
    etag: snapshot.etag ?? null,
    fetchedAt: snapshot.fetchedAt ?? null,
    source: snapshot.source ?? null,
  };
}

export function assertDictionaryExtends(
  current: DeckHashDictionary,
  next: DeckHashDictionary,
): void {
  if (next.cards.length < current.cards.length) {
    throw new DeckHashDictionaryContractError(
      `Dictionary shrank from ${current.cards.length} to ${next.cards.length}`,
    );
  }

  for (let index = 0; index < current.cards.length; index += 1) {
    if (current.cards[index] !== next.cards[index]) {
      throw new DeckHashDictionaryContractError(
        `Dictionary changed at index ${index}: expected ${current.cards[index]}, received ${next.cards[index]}`,
      );
    }
  }
}

export function isDeckHashDictionary(value: DeckHashDictionaryInput): value is DeckHashDictionary {
  return !Array.isArray(value) && "indexByCardNumber" in value;
}

function normalizeCardNumber(value: string, index: number): string {
  if (typeof value !== "string") {
    throw new DeckHashDictionaryContractError(`Dictionary value at index ${index} is not a string`);
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    throw new DeckHashDictionaryContractError(`Dictionary value at index ${index} is empty`);
  }
  return normalized;
}
