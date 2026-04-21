import crypto from 'crypto';

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
    this.value = RANKS.indexOf(rank);
  }

  toString() {
    const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return `${this.rank}${suitSymbols[this.suit]}`;
  }

  toJSON() {
    return { rank: this.rank, suit: this.suit, value: this.value };
  }
}

export class Deck {
  constructor(variant = 'texas') {
    this.variant = variant;
    this.cards = [];
    this.reset(variant);
  }

  reset(variant) {
    if (variant) this.variant = variant;
    this.cards = [];
    const validRanks = this.variant === 'shortdeck' 
      ? ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] 
      : RANKS;

    for (const suit of SUITS) {
      for (const rank of validRanks) {
        this.cards.push(new Card(rank, suit));
      }
    }
    return this;
  }

  shuffle() {
    // Fisher-Yates with crypto-secure randomness
    for (let i = this.cards.length - 1; i > 0; i--) {
      const bytes = crypto.randomBytes(4);
      const j = bytes.readUInt32BE(0) % (i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  deal(count = 1) {
    if (this.cards.length < count) throw new Error('Not enough cards');
    return this.cards.splice(0, count);
  }

  get remaining() {
    return this.cards.length;
  }
}

export { SUITS, RANKS };
