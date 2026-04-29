export type DeckHashEntry = {
  card_number: string;
  count: number;
  variant_index?: number;
};

export type DeckHashDeck = {
  leader: DeckHashEntry | null;
  main: DeckHashEntry[];
  don: DeckHashEntry | null;
  format?: string;
};

export type DeckHashDictionarySnapshot = {
  cards: string[];
  etag?: string | null;
  fetchedAt?: string | null;
  source?: string | null;
};

export type DeckHashDictionary = {
  cards: readonly string[];
  indexByCardNumber: ReadonlyMap<string, number>;
  etag: string | null;
  fetchedAt: string | null;
  source: string | null;
};

export type DeckHashDictionaryInput =
  | DeckHashDictionary
  | DeckHashDictionarySnapshot
  | readonly string[];

export type CompressionMode = "auto" | "raw";

export type EncodeDeckHashOptions = {
  compression?: CompressionMode;
};

export type DecodeDeckHashOptions = {
  refreshOnUnknownDictionaryId?: boolean;
};

export type FetchDeckDictionaryOptions = {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  etag?: string | null;
  headers?: HeadersInit;
};

export type FetchDeckDictionaryResult = {
  dictionary: DeckHashDictionary | null;
  etag: string | null;
  notModified: boolean;
};

export interface DeckHashDictionarySource {
  loadDictionary(current: DeckHashDictionary): Promise<DeckHashDictionaryInput>;
}

export type CreateDeckHashCodecOptions = {
  dictionary?: DeckHashDictionaryInput;
  dictionarySource?: DeckHashDictionarySource | null;
  compression?: CompressionMode;
};

