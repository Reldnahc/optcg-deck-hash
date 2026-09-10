# Deck hash compatibility fixtures

`op17-deck.json` archives a reported production hash, its decoded deck, and the
canonical dictionary read from `https://api.poneglyph.one/v1/decks/dictionary`.
The dictionary contains 2,809 entries. Its first 2,647 entries reproduce the
bundled snapshot used by the affected web dependency (`optcg-deck-hash@0.1.4`).

The hash first needs a missing dictionary ID at index 2687 (`OP17-112`). The
regression test starts with the archived prefix and serves the full archived
dictionary through a mocked API response. Tests never fetch live card data.

Keep this fixture unchanged when refreshing the package's bundled dictionary:
it must continue exercising an older reader against a newer encoded deck.
