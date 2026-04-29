# optcg-deck-hash

Standalone deck hash codec for OPTCG.

The package ships with a bundled card dictionary snapshot. That gives you deterministic offline encode/decode out of the box.

For newest-card support, configure the API helper. The codec will only call the API on decode if it hits an unknown dictionary id and needs a newer dictionary snapshot to recover the card number.

## Install

```bash
npm install optcg-deck-hash
```

## Usage

```ts
import { decodeDeckHash, encodeDeckHash } from "optcg-deck-hash";

const hash = await encodeDeckHash({
  leader: { card_number: "OP01-001", count: 1 },
  main: [{ card_number: "OP01-006", count: 4 }],
  don: null,
});

const deck = await decodeDeckHash(hash);
```

## Recommended API-Backed Codec

```ts
import {
  createApiDeckHashDictionarySource,
  createDeckHashCodec,
} from "optcg-deck-hash";

const codec = createDeckHashCodec({
  dictionarySource: createApiDeckHashDictionarySource({
    baseUrl: "https://poneglyph.one",
  }),
});

const hash = await codec.encode(deck);
const decoded = await codec.decode(hash);
```

In that mode:

- the bundled dictionary is used first
- `encode()` does not call the API if a card is missing from the bundled dictionary
- `decode()` retries once with the API only if it encounters an unknown dictionary id

## Dictionary Refresh

```ts
await codec.refreshDictionary();
```

Use this when you want proactive newest-card support instead of waiting for a decode miss.

## Release Workflow

Refresh the bundled snapshot before publish:

```bash
npm run sync:dictionary -- --base-url=https://poneglyph.one
```

That updates `src/data/dictionary.json` from `/v1/decks/dictionary`.

## GitHub Actions Publish

This repo includes a trusted-publishing workflow at `.github/workflows/publish.yml`.

- It runs on pushes to `main` and `master`.
- It also supports manual `workflow_dispatch`.
- It installs dependencies and runs `npm test`.
- It bumps the patch version automatically before publish.
- It publishes with npm trusted publishing via GitHub Actions OIDC.
- It commits the version bump and tags the release after publish.

Trusted publisher settings on npm should be:

- Organization or user: `Reldnahc`
- Repository: `optcg-deck-hash`
- Workflow filename: `publish.yml`
- Environment name: leave blank unless you later protect publishes with a GitHub environment

Important: npm trusted publishing currently appears to require the package to already exist on npm before you can configure the trusted publisher in the npm UI. In practice that means a one-time bootstrap publish is still needed for a brand-new package before the OIDC workflow can take over.
