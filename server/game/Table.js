import { Deck } from './Deck.js';
import { evaluateHand, determineWinners } from './HandEvaluator.js';

const PHASES = ['waiting', 'preflop', 'flop', 'turn', 'river', 'showdown'];

export class Table {
  constructor(settings = {}) {
    this.settings = {
      variant: settings.variant || 'texas',
      smallBlind: settings.smallBlind || 5,
      bigBlind: settings.bigBlind || 10,
      startingChips: settings.startingChips || 1000,
      turnTime: settings.turnTime || 30,
      maxPlayers: settings.maxPlayers || 8,
      ...settings
    };

    this.players = [];
    this.deck = new Deck(this.settings.variant);
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.phase = 'waiting';
    this.dealerIndex = 0;
    this.currentPlayerIndex = -1;
    this.currentBet = 0;
    this.minRaise = this.settings.bigBlind;
    this.lastRaiserIndex = -1;
    this.roundBets = {};
    this.handNumber = 0;
    this.turnTimer = null;
    this.turnStartTime = null;
  }

  addPlayer(id, username, avatar, options = {}) {
    if (this.players.length >= this.settings.maxPlayers) return null;
    if (this.players.find(p => p.id === id)) return null;

    const sittingOut = !!options.sittingOut;
    const player = {
      id,
      username,
      avatar,
      chips: this.settings.startingChips,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      folded: sittingOut, // folded for the current hand if joining mid-game
      allIn: false,
      sitting: true,
      disconnected: false,
      isReady: false,
      sittingOut    // waits for the next hand
    };

    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx === -1) return;

    if (this.phase !== 'waiting') {
      this.players[idx].disconnected = true;
      this.players[idx].folded = true;
      if (this.currentPlayerIndex === idx) {
        this._nextTurn();
      }
    } else {
      this.players.splice(idx, 1);
    }
  }

  setReady(id, ready) {
    const player = this.players.find(p => p.id === id);
    if (player) player.isReady = ready;
  }

  canStart() {
    const activePlayers = this.players.filter(p => !p.disconnected);
    return activePlayers.length >= 2 && activePlayers.every(p => p.isReady);
  }

  startHand() {
    // Clean up disconnected players
    this.players = this.players.filter(p => !p.disconnected);

    const active = this.players.filter(p => p.chips > 0);
    if (active.length < 2) return false;

    this.handNumber++;
    this.deck.reset(this.settings.variant).shuffle();
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.minRaise = this.settings.bigBlind;
    this.roundBets = {};
    this.lastRaiserIndex = -1;

    // Reset player hand state
    for (const p of this.players) {
      p.holeCards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.sittingOut = false;  // cleared for the new hand
      p.folded = p.chips <= 0;
      p.allIn = false;
      p.handStats = {
        vpip: false,
        pfr: false,
        atsOpp: false,
        atsAttempt: false,
        aggrBets: 0,
        aggrCalls: 0,
        wtsd: false
      };
    }

    // Move dealer
    this._advanceDealer();

    // Post blinds
    this._postBlinds();

    // Deal hole cards
    let cardsToDeal = 2;
    if (this.settings.variant === 'omaha') cardsToDeal = 4;
    else if (this.settings.variant === 'courchevel') cardsToDeal = 5;
    else if (this.settings.variant === 'pineapple') cardsToDeal = 3;
    else if (this.settings.variant === 'irish') cardsToDeal = 4;

    for (const p of this.players) {
      if (!p.folded) {
        p.holeCards = this.deck.deal(cardsToDeal);
      }
    }

    // Courchevel Spit Card: reveal 1st card of flop immediately
    if (this.settings.variant === 'courchevel') {
      this.communityCards = this.deck.deal(1);
    }

    this.phase = 'preflop';
    this.isUnopenedPreflop = true;

    // First to act is after BB (or after dealer in heads-up)
    if (active.length === 2) {
      this.currentPlayerIndex = this.dealerIndex; // SB acts first preflop in HU
    } else {
      this.currentPlayerIndex = this._getNextActiveIndex(this._getBBIndex());
    }

    this._startTurnTimer();
    return true;
  }

  handleAction(playerId, action, amount = 0) {
    if (this.phase === 'waiting' || this.phase === 'showdown') return { error: 'Partie en attente' };

    const playerIdx = this.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1 || playerIdx !== this.currentPlayerIndex) return { error: 'Pas votre tour' };

    const player = this.players[playerIdx];
    if (player.folded || player.allIn) return { error: 'Action impossible' };

    this._clearTurnTimer();

    // -- STATS TRACKING --
    if (['call', 'raise', 'allin'].includes(action)) {
      if (this.phase === 'preflop') {
        player.handStats.vpip = true;
      }
    }
    
    if (['raise', 'allin'].includes(action)) {
      const isRaise = action === 'raise' || (player.chips > (this.currentBet - player.bet));
      if (this.phase === 'preflop' && isRaise) {
        player.handStats.pfr = true;
      }
      if (isRaise) {
        player.handStats.aggrBets++;
      } else {
        player.handStats.aggrCalls++;
      }
    } else if (action === 'call') {
      player.handStats.aggrCalls++;
    }

    // ATS (Attempt To Steal) Logic
    if (this.phase === 'preflop' && this.isUnopenedPreflop) {
      const activeCount = this.players.filter(p => !p.disconnected && p.chips > 0).length;
      // In 2-player, SB acts first and can steal.
      // In 3+ players, CO, BTN, SB are the last 3 before BB.
      // Easiest check: is the player acting within the last 3 active players?
      // Number of players who acted is 0 since isUnopenedPreflop is true.
      // If we are <= 3 positions away from BB (inclusive of SB), it's a steal pos.
      // Just check if this is the BTN, SB, or CO.
      let isStealPosition = false;
      if (activeCount === 2) {
        isStealPosition = true; // SB acts first and can steal BB
      } else {
        const bbIdx = this._getBBIndex();
        const sbIdx = this.players.findIndex(p => p === this.players[this._getNextActiveIndex(this.dealerIndex)]);
        let btnIdx = this.dealerIndex;
        // find CO index (active player before BTN)
        let coIdx = (btnIdx - 1 + this.players.length) % this.players.length;
        let safety = 0;
        while ((this.players[coIdx].folded || this.players[coIdx].chips <= 0) && safety < this.players.length) {
          coIdx = (coIdx - 1 + this.players.length) % this.players.length;
          safety++;
        }
        if (playerIdx === btnIdx || playerIdx === sbIdx || playerIdx === coIdx) {
          isStealPosition = true;
        }
      }

      if (isStealPosition) {
        player.handStats.atsOpp = true;
        if (['raise'].includes(action) || (action === 'allin' && player.chips > (this.currentBet - player.bet))) {
          player.handStats.atsAttempt = true;
        }
      }
    }

    if (['call', 'raise', 'allin'].includes(action) && this.phase === 'preflop') {
      // If someone limps, it's unopened no more
      this.isUnopenedPreflop = false;
    }
    // -- END STATS TRACKING --

    let result = {};

    switch (action) {
      case 'fold':
        result = this._fold(player);
        break;
      case 'check':
        result = this._check(player);
        break;
      case 'call':
        result = this._call(player);
        break;
      case 'raise':
        result = this._raise(player, amount);
        break;
      case 'allin':
        result = this._allIn(player);
        break;
      default:
        return { error: 'Unknown action' };
    }

    if (result.error) return result;

    // Check if hand is over
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      return this._endHand([{ playerId: activePlayers[0].id, username: activePlayers[0].username }]);
    }

    // Check if betting round is complete
    if (this._isBettingRoundComplete()) {
      return this._advancePhase();
    }

    // Next player's turn
    // Next player's turn
    this._nextTurn();
    this._startTurnTimer();

    return { success: true, action, player: player.username };
  }

  playerDiscard(playerId, keptCards) {
    if (this.phase !== 'discardWait') return { error: 'Not in discard phase' };
    
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };
    if (player.folded) return { error: 'Player is folded' };
    if (player.hasDiscarded) return { error: 'Already discarded' };

    // Validations: exactly 2 cards
    if (!Array.isArray(keptCards) || keptCards.length !== 2) {
      return { error: 'You must keep exactly 2 cards' };
    }

    // Verify the kept cards are actually in the player's holeCards
    const validKeep = keptCards.every(kc => 
      player.holeCards.some(hc => hc.rank === kc.rank && hc.suit === kc.suit)
    );

    if (!validKeep) {
      return { error: 'Invalid cards kept' };
    }

    // Apply keep
    player.holeCards = keptCards;
    player.hasDiscarded = true;

    // Check if everyone active has discarded
    const activePlayers = this.players.filter(p => !p.folded);
    const allDiscarded = activePlayers.every(p => p.hasDiscarded);

    if (allDiscarded) {
      const adv = this._advancePhase();
      return { success: true, phaseChange: true, advanceResult: adv };
    }

    return { success: true, waiting: true };
  }

  _fold(player) {
    player.folded = true;
    return { success: true, action: 'fold' };
  }

  _check(player) {
    if (this.currentBet > player.bet) {
      return { error: 'Vous ne pouvez pas checker, il y a une mise en cours' };
    }
    this.roundBets[player.id] = true;
    return { success: true, action: 'check' };
  }

  _call(player) {
    const toCall = Math.min(this.currentBet - player.bet, player.chips);
    if (toCall <= 0) return this._check(player);

    player.chips -= toCall;
    player.bet += toCall;
    player.totalBet += toCall;
    this.pot += toCall;

    if (player.chips === 0) player.allIn = true;

    this.roundBets[player.id] = true;
    return { success: true, action: 'call', amount: toCall };
  }

  _raise(player, amount) {
    const toCall = this.currentBet - player.bet;
    const totalNeeded = toCall + amount;

    if (amount < this.minRaise && totalNeeded < player.chips) {
      return { error: `La relance minimum est de ${this.minRaise}` };
    }

    const actualAmount = Math.min(totalNeeded, player.chips);
    player.chips -= actualAmount;
    player.bet += actualAmount;
    player.totalBet += actualAmount;
    this.pot += actualAmount;

    if (player.bet > this.currentBet) {
      this.minRaise = player.bet - this.currentBet;
      this.currentBet = player.bet;
      this.lastRaiserIndex = this.currentPlayerIndex;
    }

    if (player.chips === 0) player.allIn = true;

    // Reset round tracking — everyone needs to act again
    this.roundBets = { [player.id]: true };

    return { success: true, action: 'raise', amount: actualAmount };
  }

  _allIn(player) {
    const amount = player.chips;
    player.chips = 0;
    player.bet += amount;
    player.totalBet += amount;
    this.pot += amount;
    player.allIn = true;

    if (player.bet > this.currentBet) {
      this.minRaise = player.bet - this.currentBet;
      this.currentBet = player.bet;
      this.lastRaiserIndex = this.currentPlayerIndex;
      this.roundBets = { [player.id]: true };
    } else {
      this.roundBets[player.id] = true;
    }

    return { success: true, action: 'allin', amount };
  }

  _postBlinds() {
    const active = this.players.filter(p => !p.folded);
    let sbIdx, bbIdx;

    if (active.length === 2) {
      sbIdx = this.dealerIndex;
      bbIdx = this._getNextActiveIndex(this.dealerIndex);
    } else {
      sbIdx = this._getNextActiveIndex(this.dealerIndex);
      bbIdx = this._getNextActiveIndex(sbIdx);
    }

    const sb = this.players[sbIdx];
    const bb = this.players[bbIdx];

    const sbAmount = Math.min(this.settings.smallBlind, sb.chips);
    sb.chips -= sbAmount;
    sb.bet = sbAmount;
    sb.totalBet = sbAmount;
    this.pot += sbAmount;
    if (sb.chips === 0) sb.allIn = true;

    const bbAmount = Math.min(this.settings.bigBlind, bb.chips);
    bb.chips -= bbAmount;
    bb.bet = bbAmount;
    bb.totalBet = bbAmount;
    this.pot += bbAmount;
    this.currentBet = bbAmount;
    if (bb.chips === 0) bb.allIn = true;
  }

  _getBBIndex() {
    const active = this.players.filter(p => !p.folded);
    if (active.length === 2) {
      return this._getNextActiveIndex(this.dealerIndex);
    }
    const sbIdx = this._getNextActiveIndex(this.dealerIndex);
    return this._getNextActiveIndex(sbIdx);
  }

  _advanceDealer() {
    if (this.handNumber === 1) {
      this.dealerIndex = 0;
      return;
    }
    this.dealerIndex = this._getNextActiveIndex(this.dealerIndex);
  }

  _getNextActiveIndex(fromIndex) {
    let idx = (fromIndex + 1) % this.players.length;
    let safety = 0;
    while ((this.players[idx].folded || this.players[idx].chips <= 0) && safety < this.players.length) {
      idx = (idx + 1) % this.players.length;
      safety++;
    }
    return idx;
  }

  _nextTurn() {
    let idx = (this.currentPlayerIndex + 1) % this.players.length;
    let safety = 0;
    while (safety < this.players.length) {
      const p = this.players[idx];
      if (!p.folded && !p.allIn) {
        this.currentPlayerIndex = idx;
        return;
      }
      idx = (idx + 1) % this.players.length;
      safety++;
    }
    this.currentPlayerIndex = -1;
  }

  _isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => !p.folded && !p.allIn);

    if (activePlayers.length === 0) return true;
    if (activePlayers.length === 1 && activePlayers[0].bet >= this.currentBet) return true;

    return activePlayers.every(p => this.roundBets[p.id] && p.bet === this.currentBet);
  }

  _advancePhase() {
    if (this.phase === 'showdown' || this.phase === 'waiting') return;

    // Reset bets for next round
    for (const p of this.players) {
      p.bet = 0;
    }
    this.currentBet = 0;
    this.minRaise = this.settings.bigBlind;
    this.roundBets = {};
    this.lastRaiserIndex = -1;

    const activePlayers = this.players.filter(p => !p.folded);
    const canAct = activePlayers.filter(p => !p.allIn);

    switch (this.phase) {
      case 'preflop':
        if (this.settings.variant === 'pineapple') {
          this.phase = 'discardWait';
          this.currentPlayerIndex = -1;
          this._clearTurnTimer();
          activePlayers.forEach(p => p.hasDiscarded = false);

          // Si All-In runout : défausse automatique immédiate
          if (canAct.length <= 1) {
            activePlayers.forEach(p => {
              if (p.holeCards.length > 2) p.holeCards = p.holeCards.slice(0, 2);
              p.hasDiscarded = true;
            });
            return this._advancePhase();
          }

          return { success: true, phase: this.phase, communityCards: this.communityCards, waitingForDiscard: true };
        }
        this.phase = 'flop';
        if (this.settings.variant === 'courchevel') {
          this.communityCards.push(...this.deck.deal(2));
        } else {
          this.communityCards = this.settings.variant === 'reverse' ? this.deck.deal(1) : this.deck.deal(3);
        }
        break;
      case 'flop':
        if (this.settings.variant === 'irish') {
          this.phase = 'discardWait';
          this.currentPlayerIndex = -1;
          this._clearTurnTimer();
          activePlayers.forEach(p => p.hasDiscarded = false);

          // Si All-In runout : défausse automatique immédiate
          if (canAct.length <= 1) {
            activePlayers.forEach(p => {
              if (p.holeCards.length > 2) p.holeCards = p.holeCards.slice(0, 2);
              p.hasDiscarded = true;
            });
            return this._advancePhase();
          }

          return { success: true, phase: this.phase, communityCards: this.communityCards, waitingForDiscard: true };
        } else {
          this.phase = 'turn';
          this.communityCards.push(...this.deck.deal(1));
        }
        break;
      case 'discardWait':
        if (this.settings.variant === 'pineapple') {
          // Après défausse Pineapple -> Flop (3 cartes)
          this.phase = 'flop';
          this.communityCards = this.deck.deal(3);
        } else {
          // Après défausse Irish -> Turn (1 carte)
          this.phase = 'turn';
          this.communityCards.push(...this.deck.deal(1));
        }
        break;
      case 'turn':
        this.phase = 'river';
        this.communityCards.push(...(this.settings.variant === 'reverse' ? this.deck.deal(3) : this.deck.deal(1)));
        break;
      case 'river':
        return this._showdown();
    }

    // If only one player can act (or none), run through cards
    if (canAct.length <= 1 && this.phase !== 'showdown' && this.phase !== 'waiting') {
      return this._advancePhase();
    }

    // Set first to act after dealer
    this.currentPlayerIndex = this._getNextActiveIndex(this.dealerIndex);
    this._startTurnTimer();

    return { success: true, phase: this.phase, communityCards: this.communityCards };
  }

  _showdown() {
    this.phase = 'showdown';

    const activePlayers = this.players
      .filter(p => !p.folded);

    activePlayers.forEach(p => {
      if (p.handStats) p.handStats.wtsd = true;
    });

    const mappedPlayers = activePlayers
      .map(p => ({ id: p.id, username: p.username, holeCards: p.holeCards }));

    const winners = determineWinners(mappedPlayers, this.communityCards, this.settings.variant);
    return this._endHand(winners);
  }

  _endHand(winners) {
    this._clearTurnTimer();
    this.phase = 'showdown';

    // Calculate side pots
    const pots = this._calculatePots();

    const winnings = {};
    for (const pot of pots) {
      let eligible = winners.filter(w => pot.eligible.includes(w.playerId));
      
      // If no winner is eligible for this specific pot (e.g. all-in with smaller stacks)
      // give the pot to the closest winners
      if (eligible.length === 0) {
        eligible = winners; 
      }
      
      if (eligible.length === 0) continue;

      const share = Math.floor(pot.amount / eligible.length);
      const remainder = pot.amount - share * eligible.length;

      eligible.forEach((w, i) => {
        winnings[w.playerId] = (winnings[w.playerId] || 0) + share + (i === 0 ? remainder : 0);
      });
    }

    // Apply winnings
    for (const [pid, amount] of Object.entries(winnings)) {
      const player = this.players.find(p => p.id === pid);
      if (player) {
        player.chips += amount;
        this.pot -= amount; // Drain the pot
      }
    }
    
    // Ensure pot is 0
    this.pot = 0;

    const result = {
      success: true,
      phase: 'showdown',
      winners: winners.map(w => ({
        ...w,
        amount: winnings[w.playerId] || 0
      })),
      communityCards: this.communityCards,
      playerHands: this.players
        .filter(p => !p.folded)
        .map(p => ({
          playerId: p.id,
          username: p.username,
          holeCards: p.holeCards,
          hand: p.holeCards.length > 0 ? evaluateHand(p.holeCards, this.communityCards, this.settings.variant) : null
        })),
      playerStats: this.players.map(p => ({
        playerId: p.id,
        handStats: p.handStats
      })),
      pot: this.pot
    };

    // Schedule next hand
    this.phase = 'waiting';
    this.currentPlayerIndex = -1;

    return result;
  }

  _calculatePots() {
    const bettors = this.players
      .filter(p => p.totalBet > 0)
      .sort((a, b) => a.totalBet - b.totalBet);

    const pots = [];
    let processed = 0;

    for (let i = 0; i < bettors.length; i++) {
      const level = bettors[i].totalBet;
      if (level <= processed) continue;

      const contribution = level - processed;
      let potAmount = 0;
      const eligible = [];

      for (const p of this.players) {
        if (p.totalBet > processed) {
          potAmount += Math.min(contribution, p.totalBet - processed);
        }
        if (!p.folded && p.totalBet >= level) {
          eligible.push(p.id);
        }
      }

      if (potAmount > 0) {
        pots.push({ amount: potAmount, eligible });
      }
      processed = level;
    }

    if (pots.length === 0) {
      pots.push({
        amount: this.pot,
        eligible: this.players.filter(p => !p.folded).map(p => p.id)
      });
    }

    return pots;
  }

  _startTurnTimer() {
    this.turnStartTime = Date.now();
    this._clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      const player = this.players[this.currentPlayerIndex];
      if (player && !player.folded && !player.allIn) {
        this.handleAction(player.id, this.currentBet > player.bet ? 'fold' : 'check');
        if (this._onTimerAction) this._onTimerAction();
      }
    }, this.settings.turnTime * 1000);
  }

  _clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  getStateForPlayer(playerId) {
    return {
      phase: this.phase,
      pot: this.pot,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerIndex: this.dealerIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      handNumber: this.handNumber,
      turnStartTime: this.turnStartTime,
      turnTime: this.settings.turnTime,
      settings: this.settings,
      blindsVoteRequested: this.blindsVoteRequested,
      blindsVotes: this.blindsVotes,
      players: this.players.map((p, idx) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        isReady: p.isReady,
        hasDiscarded: p.hasDiscarded,
        disconnected: p.disconnected,
        sittingOut: !!p.sittingOut,
        holeCards: p.id === playerId ? p.holeCards :
          (this.phase === 'showdown' && !p.folded ? p.holeCards : []),
        isCurrentPlayer: idx === this.currentPlayerIndex,
        isDealer: idx === this.dealerIndex
      }))
    };
  }

  getAvailableActions(playerId) {
    const playerIdx = this.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1 || playerIdx !== this.currentPlayerIndex) return [];
    const player = this.players[playerIdx];
    if (player.folded || player.allIn) return [];

    const actions = ['fold'];
    const toCall = this.currentBet - player.bet;

    if (toCall <= 0) {
      actions.push('check');
    } else {
      actions.push('call');
    }

    if (player.chips > toCall) {
      actions.push('raise');
    }

    actions.push('allin');

    return actions;
  }

  resetForNewGame() {
    this.phase = 'waiting';
    this.handNumber = 0;
    this.dealerIndex = 0;
    this.currentPlayerIndex = -1;
    this.pot = 0;
    this.communityCards = [];
    this.roundBets = {};
    this.blindsVoteRequested = false;
    this.blindsVotes = null;
    for (const p of this.players) {
      if (!p.disconnected) {
        p.chips = this.settings.startingChips;
        p.holeCards = [];
        p.bet = 0;
        p.totalBet = 0;
        p.folded = false;
        p.allIn = false;
        p.isReady = false;
        p.hasDiscarded = false;
      }
    }
  }

  // ──── BLINDS VOTING ────
  startBlindsVote() {
    this.phase = 'blinds_vote';
    this.blindsVoteRequested = false; // reset flag
    this.blindsVotes = { increase: 0, keep: 0, votedPlayers: [] };
    this.currentPlayerIndex = -1;
    this._clearTurnTimer();
    
    // Set a timer for 10 seconds for voting
    this.turnTimer = setTimeout(() => {
      this._resolveBlindsVote();
      if (this.onBlindsVoteResolved) this.onBlindsVoteResolved();
    }, 10000);
  }

  voteBlinds(playerId, voteChoice) {
    if (this.phase !== 'blinds_vote') return { error: 'Vote non actif' };
    
    const activePlayers = this.players.filter(p => !p.disconnected && p.chips > 0);
    const validIds = activePlayers.map(p => p.id);
    if (!validIds.includes(playerId)) return { error: 'Non autorisé à voter' };
    
    if (this.blindsVotes.votedPlayers.includes(playerId)) return { error: 'Déjà voté' };

    this.blindsVotes.votedPlayers.push(playerId);
    if (voteChoice === 'increase') {
      this.blindsVotes.increase++;
    } else {
      this.blindsVotes.keep++;
    }

    // Resolve early if everyone voted
    if (this.blindsVotes.votedPlayers.length === activePlayers.length) {
      this._clearTurnTimer();
      this._resolveBlindsVote();
      if (this.onBlindsVoteResolved) this.onBlindsVoteResolved();
    }
    
    return { success: true };
  }

  _resolveBlindsVote() {
    // If stricly more votes to increase
    if (this.blindsVotes.increase > this.blindsVotes.keep) {
      this.settings.smallBlind *= 2;
      this.settings.bigBlind *= 2;
    }
    this.blindsVotes = null;
  }

  destroy() {
    this._clearTurnTimer();
  }
}
