export class DeckHashDictionaryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckHashDictionaryContractError";
  }
}

export class UnknownDeckHashDictionaryIdError extends Error {
  readonly cardId: number;
  readonly dictionarySize: number;

  constructor(cardId: number, dictionarySize: number) {
    super(`Unknown deck hash dictionary id ${cardId}`);
    this.name = "UnknownDeckHashDictionaryIdError";
    this.cardId = cardId;
    this.dictionarySize = dictionarySize;
  }
}

