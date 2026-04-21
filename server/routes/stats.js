import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import User from '../models/User.js';
import GameHistory from '../models/GameHistory.js';
import { getRank } from '../game/elo.js';

const router = express.Router();

/**
 * GET /api/stats/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const raw  = user.stats || {};

    const s = {
      gamesPlayed:      raw.gamesPlayed      || 0,
      gamesWon:         raw.gamesWon         || 0,
      totalEarnings:    raw.totalEarnings    || 0,
      biggestPot:       raw.biggestPot       || 0,
      handsDealt:       raw.handsDealt       || 0,
      handsPlayed:      raw.handsPlayed      || 0,
      handsWon:         raw.handsWon         || 0,
      pfrCount:         raw.pfrCount         || 0,
      vpipCount:        raw.vpipCount        || 0,
      atsOpportunities: raw.atsOpportunities || 0,
      atsCount:         raw.atsCount         || 0,
      wtsdCount:        raw.wtsdCount        || 0,
      wssdCount:        raw.wssdCount        || 0,
      aggrBets:         raw.aggrBets         || 0,
      aggrCalls:        raw.aggrCalls        || 0,
    };

    // Derived percentages (safe division)
    const winRate    = s.gamesPlayed      > 0 ? (s.gamesWon    / s.gamesPlayed      * 100) : 0;
    const vpip       = s.handsDealt       > 0 ? (s.vpipCount   / s.handsDealt       * 100) : 0;
    const pfr        = s.handsDealt       > 0 ? (s.pfrCount    / s.handsDealt       * 100) : 0;
    const ats        = s.atsOpportunities > 0 ? (s.atsCount    / s.atsOpportunities * 100) : 0;
    const wtsd       = s.handsPlayed      > 0 ? (s.wtsdCount   / s.handsPlayed      * 100) : 0;
    const wssd       = s.wtsdCount        > 0 ? (s.wssdCount   / s.wtsdCount        * 100) : 0;
    const aggression = s.aggrCalls        > 0 ? (s.aggrBets    / s.aggrCalls)               : 0;

    // ELO & rank
    const elo    = user.elo ?? 0;
    const rank   = getRank(elo);
    const ranked = user.ranked || { gamesPlayed: 0, gamesWon: 0, peakElo: 0 };

    // Last 5 games
    const recentGames = await GameHistory.find({ 'players.userId': user._id })
      .sort({ endedAt: -1 })
      .limit(5)
      .select('winnerId winnerUsername totalHands settings startedAt endedAt duration players');

    res.json({
      stats: {
        handsDealt:    s.handsDealt    || 0,
        handsPlayed:   s.handsPlayed   || 0,
        handsWon:      s.handsWon      || 0,
        gamesPlayed:   s.gamesPlayed   || 0,
        gamesWon:      s.gamesWon      || 0,
        biggestPot:    s.biggestPot    || 0,
        totalEarnings: s.totalEarnings || 0,
        winRate:    +winRate.toFixed(1),
        vpip:       +vpip.toFixed(1),
        pfr:        +pfr.toFixed(1),
        ats:        +ats.toFixed(1),
        wtsd:       +wtsd.toFixed(1),
        wssd:       +wssd.toFixed(1),
        aggression: +aggression.toFixed(2),
      },
      // ── Ranked ──
      elo,
      rank: {
        name:  rank.name,
        emoji: rank.emoji,
        color: rank.color,
        min:   rank.min,
        max:   rank.max === Infinity ? null : rank.max,
      },
      ranked: {
        gamesPlayed: ranked.gamesPlayed || 0,
        gamesWon:    ranked.gamesWon    || 0,
        peakElo:     ranked.peakElo     || 0,
        winRate: ranked.gamesPlayed > 0
          ? +((ranked.gamesWon / ranked.gamesPlayed) * 100).toFixed(1)
          : 0,
      },
      recentGames: recentGames.map(g => ({
        pin:            g.roomPin,
        totalHands:     g.totalHands,
        won:            g.winnerId?.toString() === user._id.toString(),
        winnerUsername: g.winnerUsername,
        duration:       g.duration,
        startedAt:      g.startedAt,
        settings:       g.settings,
        myChips:        g.players.find(p => p.userId?.toString() === user._id.toString())?.finalChips ?? 0
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
