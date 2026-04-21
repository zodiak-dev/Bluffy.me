/**
 * elo.js — Système ELO + Rangs pour Bluffy.me
 *
 * Rangs (par ELO) :
 *   Unranked     : 0        (jamais joué en ranked)
 *   Iron         : 1 – 499
 *   Bronze       : 500 – 999
 *   Gold         : 1 000 – 1 499
 *   Diamond      : 1 500 – 1 999
 *   Unbreakable  : 2 000 – 2 499
 *   Mythic       : 2 500+
 */

export const RANKS = [
  { name: 'Unranked',    min: 0,    max: 0,    emoji: '❓', color: '#6b7280' },
  { name: 'Iron',        min: 1,    max: 499,  emoji: '🔩', color: '#9ca3af' },
  { name: 'Bronze',      min: 500,  max: 999,  emoji: '🥉', color: '#cd7f32' },
  { name: 'Gold',        min: 1000, max: 1499, emoji: '🥇', color: '#ffd700' },
  { name: 'Diamond',     min: 1500, max: 1999, emoji: '💎', color: '#67e8f9' },
  { name: 'Unbreakable', min: 2000, max: 2499, emoji: '🔱', color: '#a78bfa' },
  { name: 'Mythic',      min: 2500, max: Infinity, emoji: '🌟', color: '#f97316' },
];

/**
 * Retourne le rang correspondant à un ELO.
 * @param {number} elo
 * @returns {{ name, min, max, emoji, color }}
 */
export function getRank(elo) {
  if (elo === 0) return RANKS[0]; // Unranked
  return RANKS.find(r => elo >= r.min && elo <= r.max) ?? RANKS[RANKS.length - 1];
}

/**
 * Calcule le facteur K selon l'ELO actuel.
 * ELO bas → K grand (progression rapide)
 * ELO haut → K petit (progression lente)
 */
function kFactor(elo) {
  if (elo < 500)  return 40;
  if (elo < 1000) return 32;
  if (elo < 1500) return 24;
  if (elo < 2000) return 20;
  return 16;
}

/**
 * Score attendu du joueur A contre joueur B.
 */
function expected(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calcule les nouveaux ELOs après une partie ranked multijoueur.
 *
 * @param {Array<{ id: string, elo: number }>} players  — liste triée du + de chips au -
 * @param {string} winnerId                             — id du gagnant
 * @returns {Array<{ id: string, oldElo: number, newElo: number, delta: number }>}
 */
export function computeEloChanges(players, winnerId) {
  const n = players.length;
  if (n < 2) return players.map(p => ({ id: p.id, oldElo: p.elo, newElo: p.elo, delta: 0 }));

  // ELO moyen du lobby (référence pour chaque joueur)
  const avgElo = players.reduce((sum, p) => sum + (p.elo || 1), 0) / n;

  return players.map(p => {
    const playerElo = p.elo || 1; // jamais 0 pour le calcul (0 = unranked)
    const isWinner = p.id === winnerId;
    const actualScore = isWinner ? 1 : 0;
    const expectedScore = expected(playerElo, avgElo);
    const K = kFactor(playerElo);

    const delta = Math.round(K * (actualScore - expectedScore));

    // ELO plancher = 1 (jamais tomber à 0 une fois rankée)
    const newElo = Math.max(1, playerElo + delta);

    return {
      id: p.id,
      oldElo: playerElo,
      newElo,
      delta,
    };
  });
}
