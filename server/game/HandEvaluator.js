import { RANKS } from './Deck.js';

const HAND_RANKS = {
  ROYAL_FLUSH: 9,
  STRAIGHT_FLUSH: 8,
  FOUR_OF_A_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  ONE_PAIR: 1,
  HIGH_CARD: 0
};

const HAND_NAMES = {
  9: 'Quinte Flush Royale',
  8: 'Quinte Flush',
  7: 'Carré',
  6: 'Full',
  5: 'Couleur',
  4: 'Quinte',
  3: 'Brelan',
  2: 'Double Paire',
  1: 'Paire',
  0: 'Carte Haute'
};

function getCardValue(card) {
  return typeof card.value === 'number' ? card.value : RANKS.indexOf(card.rank);
}

function getCombinations(arr, k) {
  const result = [];
  function combine(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

function evaluateFiveCards(cards, variant) {
  if (!cards || cards.length < 5) {
    return { rank: 0, kickers: [], name: 'Carte Haute' };
  }
  const values = cards.map(c => getCardValue(c)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = values[0];

  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
  }
  // Ace-low straight (A-2-3-4-5)
  if (values[0] === 12 && values[1] === 3 && values[2] === 2 && values[3] === 1 && values[4] === 0) {
    isStraight = true;
    straightHigh = 3; // 5 is the high card in a wheel
  }
  // Ace-low straight for Short Deck (A-6-7-8-9) -> values: 12 (A), 7 (9), 6 (8), 5 (7), 4 (6)
  if (variant === 'shortdeck' && values[0] === 12 && values[1] === 7 && values[2] === 6 && values[3] === 5 && values[4] === 4) {
    isStraight = true;
    straightHigh = 7; // 9 is the high card
  }

  // Count ranks
  const counts = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const countEntries = Object.entries(counts)
    .map(([v, c]) => ({ value: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const maxCount = countEntries[0].count;
  const secondCount = countEntries.length > 1 ? countEntries[1].count : 0;

  let rank, kickers;

  if (isFlush && isStraight) {
    if (straightHigh === 12) {
      rank = HAND_RANKS.ROYAL_FLUSH;
      kickers = [straightHigh];
    } else {
      rank = HAND_RANKS.STRAIGHT_FLUSH;
      kickers = [straightHigh];
    }
  } else if (maxCount === 4) {
    rank = HAND_RANKS.FOUR_OF_A_KIND;
    kickers = [countEntries[0].value, countEntries[1].value];
  } else if (maxCount === 3 && secondCount === 2) {
    rank = HAND_RANKS.FULL_HOUSE;
    kickers = [countEntries[0].value, countEntries[1].value];
  } else if (isFlush) {
    rank = HAND_RANKS.FLUSH;
    kickers = values;
  } else if (isStraight) {
    rank = HAND_RANKS.STRAIGHT;
    kickers = [straightHigh];
  } else if (maxCount === 3) {
    rank = HAND_RANKS.THREE_OF_A_KIND;
    kickers = [countEntries[0].value, ...countEntries.slice(1).map(e => e.value)];
  } else if (maxCount === 2 && secondCount === 2) {
    rank = HAND_RANKS.TWO_PAIR;
    const pairs = countEntries.filter(e => e.count === 2).sort((a, b) => b.value - a.value);
    const kicker = countEntries.find(e => e.count === 1);
    kickers = [pairs[0].value, pairs[1].value, kicker.value];
  } else if (maxCount === 2) {
    rank = HAND_RANKS.ONE_PAIR;
    kickers = [countEntries[0].value, ...countEntries.slice(1).map(e => e.value)];
  } else {
    rank = HAND_RANKS.HIGH_CARD;
    kickers = values;
  }

  return { rank, kickers, name: HAND_NAMES[rank] };
}

export function evaluateHand(holeCards, communityCards, variant = 'texas') {
  let combos = [];
  const isOmahaStyle = ['omaha', 'courchevel'].includes(variant);

  if (isOmahaStyle && holeCards.length >= 2 && communityCards.length >= 3) {
    const holeCombos = getCombinations(holeCards, 2);
    const commCombos = getCombinations(communityCards, 3);
    for (const hc of holeCombos) {
      for (const cc of commCombos) {
        combos.push([...hc, ...cc]);
      }
    }
  } else {
    const allCards = [...holeCards, ...communityCards];
    combos = getCombinations(allCards, 5);
  }

  let bestHand = { rank: 0, kickers: [], name: 'Carte Haute' };
  let bestCombo = holeCards.slice(0, 5);

  for (const combo of combos) {
    const result = evaluateFiveCards(combo, variant);
    if (!bestHand || !bestHand.kickers.length || compareEvaluations(result, bestHand) > 0) {
      bestHand = result;
      bestCombo = combo;
    }
  }

  return { ...bestHand, cards: bestCombo };
}

function compareEvaluations(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

export function compareHands(handA, handB) {
  return compareEvaluations(handA, handB);
}

export function determineWinners(players, communityCards, variant = 'texas') {
  if (!players || players.length === 0) return [];

  const evaluations = players.map(player => ({
    player,
    hand: evaluateHand(player.holeCards || [], communityCards, variant)
  }));

  if (evaluations.length === 0) return [];

  evaluations.sort((a, b) => compareHands(b.hand, a.hand));

  const bestHand = evaluations[0].hand;
  const winners = evaluations.filter(e => compareHands(e.hand, bestHand) === 0);

  return winners.map(w => ({
    playerId: w.player.id,
    username: w.player.username,
    hand: w.hand
  }));
}

export { HAND_RANKS, HAND_NAMES };
