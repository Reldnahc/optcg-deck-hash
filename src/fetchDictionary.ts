import { createDeckHashDictionary } from "./dictionary.js";
import type {
  DeckHashDictionarySource,
  FetchDeckDictionaryOptions,
  FetchDeckDictionaryResult,
} from "./types.js";

export async function fetchDeckDictionary(
  options: FetchDeckDictionaryOptions,
): Promise<FetchDeckDictionaryResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch API is unavailable");
  }

  const headers = new Headers(options.headers);
  if (options.etag) {
    headers.set("If-None-Match", options.etag);
  }

  const url = buildDictionaryUrl(options.baseUrl);
  const init: RequestInit = {
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
  };
  const response = await fetchImpl(url, {
    ...init,
  });

  if (response.status === 304) {
    return {
      dictionary: null,
      etag: options.etag ?? null,
      notModified: true,
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch deck dictionary: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { data?: unknown };
  if (!Array.isArray(payload.data) || payload.data.some((value) => typeof value !== "string")) {
    throw new Error("Deck dictionary response did not contain a string array");
  }

  return {
    dictionary: createDeckHashDictionary({
      cards: payload.data,
      etag: response.headers.get("etag"),
      fetchedAt: new Date().toISOString(),
      source: url,
    }),
    etag: response.headers.get("etag"),
    notModified: false,
  };
}

export function createApiDeckHashDictionarySource(
  options: Omit<FetchDeckDictionaryOptions, "etag">,
): DeckHashDictionarySource {
  return {
    async loadDictionary(current) {
      const result = await fetchDeckDictionary({
        ...options,
        etag: current.etag,
      });

      return result.dictionary ?? current;
    },
  };
}

function buildDictionaryUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  return trimmed.endsWith("/v1")
    ? `${trimmed}/decks/dictionary`
    : `${trimmed}/v1/decks/dictionary`;
}
