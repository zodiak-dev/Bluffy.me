import roomManager from '../game/RoomManager.js';
import User from '../models/User.js';
import GameHistory from '../models/GameHistory.js';
import { computeEloChanges } from '../game/elo.js';
import { BOT_CONFIG } from '../config/bot.js';
import { evaluateHand } from '../game/HandEvaluator.js';

// ──── QUICKMATCH QUEUE ────
const quickQueue = []; // [{ userId, username, avatar, socketId }]
const BOT_ID = 'BOT_BLUFFY';
const BOT_USERNAME = 'Bluffy IA';
const BOT_AVATAR = '🤖';
const QUICKMATCH_TIMEOUT = 5000; // 5 seconds

function scheduleBotAction(io, pin, room) {
  const delay = 800 + Math.random() * 1200;
  setTimeout(() => {
    const room = roomManager.getRoom(pin);
    if (!room) return;
    const botPlayer = room.table.players.find(p => p.id === BOT_ID);
    if (!botPlayer || botPlayer.folded || botPlayer.chips <= 0) return;

    // -- GESTION DE LA DEFAUSSE (Pineapple / Irish) --
    if (room.table.phase === 'discardWait' && !botPlayer.hasDiscarded) {
      // IA doit garder 2 cartes
      // Tri super basique : Garder les paires en priorité, ou les cartes les plus hautes
      const cards = [...botPlayer.holeCards];
      // Pour faire simple et hyper vite : on garde les 2 plus hautes
      // Si value n'existe pas, on tente de le deviner ou on prend juste les 2 premières
      cards.sort((a, b) => {
        const valA = typeof a.value === 'number' ? a.value : 0;
        const valB = typeof b.value === 'number' ? b.value : 0;
        return valB - valA;
      });
      const kept = [cards[0], cards[1]];

      const res = room.table.playerDiscard(BOT_ID, kept);
      if (!res.error) {
        io.to(`room:${pin}`).emit('game-event', { type: 'action', playerId: BOT_ID, username: BOT_USERNAME, action: 'discard', amount: 0 });
        broadcastStateGlobal(io, pin);
        if (res.phaseChange) {
          io.to(`room:${pin}`).emit('game-event', { type: 'phase-change', phase: room.table.phase });
          // Trigger bot if it's discard phase OR if it's their turn
          if (room.table.phase === 'discardWait') {
            // Tous les bots doivent discard
            const hasBot = room.table.players.some(p => p.id === BOT_ID && !p.folded && !p.hasDiscarded && p.chips > 0);
            if (hasBot) scheduleBotAction(io, pin, roomManager.getRoom(pin));
          }
        }
        // Si c'est à l'IA de jouer après, planifier
        const newR = roomManager.getRoom(pin);
        const nextP = newR.table.players[newR.table.currentPlayerIndex];
        if (nextP && nextP.id === BOT_ID) scheduleBotAction(io, pin, newR);
      }
      return; // On arrête là pour la défausse
    }

    const currentIdx = room.table.currentPlayerIndex;
    if (currentIdx === -1) return;
    const currentPlayer = room.table.players[currentIdx];
    if (!currentPlayer || currentPlayer.id !== BOT_ID) return;

    const actions = room.table.getAvailableActions(BOT_ID);
    let action = 'fold';

    // -- CERVEAU IA --
    let handStrength = 0.5;
    const holeC = botPlayer.holeCards;
    const commC = room.table.communityCards;

    if (holeC && holeC.length > 0) {
      if (!commC || commC.length === 0) {
        // Preflop (Standard Texas/Pineapple/Irish)
        // Note: For Courchevel, commC.length is 1, so it goes to evaluateHand
        const isPair = holeC[0].rank === holeC[1].rank;
        const hasHighCard = holeC.some(c => (typeof c.value === 'number' ? c.value : 0) >= 10);
        handStrength = isPair ? 0.9 : (hasHighCard ? 0.6 : 0.3);
      } else {
        // Flop/Turn/River or Courchevel Preflop
        try {
          const ev = evaluateHand(holeC, commC, room.table.settings.variant);
          // ev.rank va de 0 (Carte Haute) à 9 (Quinte Flush Royale)
          if (ev && typeof ev.rank === 'number') {
            handStrength = ev.rank / 9;
          }
        } catch (e) {
          console.error("Bot Eval Error:", e);
        }
      }
    }

    const skill = BOT_CONFIG.skillLevel / 100;
    const rand = Math.random();
    // Mélange entre vraie force et hasard selon le skill
    const metric = (handStrength * skill) + (rand * (1 - skill));
    const betGap = room.table.currentBet - botPlayer.bet;

    let botRaiseAmount = 0;

    if (metric > 0.75 && actions.includes('raise') && botPlayer.chips > (betGap + room.table.minRaise)) {
      action = 'raise';
      botRaiseAmount = room.table.minRaise;
    } else if (metric > 0.35 && actions.includes('call')) {
      action = 'call';
    } else if (betGap === 0 && actions.includes('check')) {
      action = 'check';
    } else if (actions.includes('fold')) {
      action = 'fold';
    } else if (actions.includes('allin') && metric > 0.9) {
      action = 'allin';
    } else if (actions.includes('call')) {
      action = 'call'; // Fallback
    }

    const result = room.table.handleAction(BOT_ID, action, botRaiseAmount);
    // Si l'action échoue, repli sur fold ou check
    if (result.error) {
      action = actions.includes('check') ? 'check' : 'fold';
      Object.assign(result, room.table.handleAction(BOT_ID, action, 0));
    }

    io.to(`room:${pin}`).emit('game-event', {
      type: 'action', playerId: BOT_ID, username: BOT_USERNAME, action, amount: result.amount || botRaiseAmount
    });

    if (result.phase === 'showdown') {
      io.to(`room:${pin}`).emit('showdown', {
        winners: result.winners, playerHands: result.playerHands,
        pot: result.pot, communityCards: result.communityCards
      });
      setTimeout(() => {
        if (room.table.players.filter(p => !p.disconnected && p.chips > 0).length >= 2) {
          room.table.startHand();
          broadcastStateGlobal(io, pin);
          io.to(`room:${pin}`).emit('game-event', { type: 'hand-start', handNumber: room.table.handNumber });
          scheduleBotAction(io, pin, room);
        } else {
          io.to(`room:${pin}`).emit('game-over', {
            winner: room.table.players.find(p => p.chips > 0),
            players: room.table.players.map(p => ({ username: p.username, chips: p.chips })),
            roundsPlayed: room.table.handNumber
          });
        }
      }, 5000);
    } else {
      broadcastStateGlobal(io, pin);
      // Check if it's still bot's turn next
      const newRoom = roomManager.getRoom(pin);
      if (newRoom) {
        const nextPlayer = newRoom.table.players[newRoom.table.currentPlayerIndex];
        if (nextPlayer && nextPlayer.id === BOT_ID) scheduleBotAction(io, pin, newRoom);
      }
    }
  }, delay);
}

function broadcastStateGlobal(io, pin) {
  const room = roomManager.getRoom(pin);
  if (!room) return;
  const sockets = io.sockets.adapter.rooms.get(`room:${pin}`);
  if (!sockets) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s?.user) {
      s.emit('game-state', {
        ...room.table.getStateForPlayer(s.user.id),
        hostId: room.hostId, pin,
        chat: room.chat.slice(-20),
        actions: room.table.getAvailableActions(s.user.id)
      });
    }
  }
}

export default function setupGameHandlers(io) {
  // Cleanup interval
  setInterval(() => roomManager.cleanup(), 10 * 60 * 1000);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`  ⚡ ${user.username} connected (${socket.id})`);

    socket.data.currentPin = null;

    // ──── ROOM EVENTS ────

    socket.on('quick-match', (variantId, callback) => {
      // In case variantId is actually the callback (from old client cache):
      if (typeof variantId === 'function') {
        callback = variantId;
        variantId = 'texas';
      }
      if (!user) return callback?.({ error: 'Non connecté' });

      const variant = variantId || 'texas';

      // Remove from queue if already in it
      const existingIdx = quickQueue.findIndex(q => q.userId === user.id);
      if (existingIdx !== -1) quickQueue.splice(existingIdx, 1);

      // FORCE LEAVE any existing room (not just what socket remembers)
      const existingRoom = roomManager.getRoomByPlayerId(user.id);
      if (existingRoom) {
        roomManager.leaveRoom(existingRoom.pin, user.id);
        socket.leave(`room:${existingRoom.pin}`);
      }

      // Cleanup local state just in case
      if (socket.data.currentPin && socket.data.currentPin !== existingRoom?.pin) {
        roomManager.leaveRoom(socket.data.currentPin, user.id);
        socket.leave(`room:${socket.data.currentPin}`);
      }
      socket.data.currentPin = null;

      // Check if someone else is waiting in queue with same variant
      const matchIdx = quickQueue.findIndex(q => q.variant === variant);
      if (matchIdx !== -1) {
        const opponent = quickQueue.splice(matchIdx, 1)[0];
        clearTimeout(opponent.botTimer);

        // Create room with opponent as host
        const { pin, room } = roomManager.createRoom(
          opponent.userId, opponent.username, opponent.avatar,
          { mode: 'casual', variant, isQuickMatch: true }
        );

        // Opponent joins socket room
        const oppSocket = io.sockets.sockets.get(opponent.socketId);
        if (oppSocket) {
          oppSocket.data.currentPin = pin;
          oppSocket.join(`room:${pin}`);
        }

        // Join self
        roomManager.joinRoom(pin, user.id, user.username, user.avatar);
        socket.data.currentPin = pin;
        socket.join(`room:${pin}`);

        // Both ready, start
        room.table.players.forEach(p => p.isReady = true);
        room.gameStarted = true;
        room.gameStartedAt = Date.now();
        room.table._onTimerAction = () => { broadcastStateGlobal(io, pin); };

        room.table.startHand();
        broadcastStateGlobal(io, pin);
        io.to(`room:${pin}`).emit('game-event', { type: 'hand-start', handNumber: room.table.handNumber });

        callback?.({ success: true, pin });
      } else {
        // Add to queue, start 5s timer for bot
        const botTimer = setTimeout(() => {
          const idx = quickQueue.findIndex(q => q.userId === user.id);
          if (idx === -1) return;
          quickQueue.splice(idx, 1);

          // Create room for player with selected variant
          const { pin, room } = roomManager.createRoom(
            user.id, user.username, user.avatar,
            { mode: 'casual', variant, isQuickMatch: true }
          );
          socket.data.currentPin = pin;
          socket.join(`room:${pin}`);

          // Add bot
          room.table.addPlayer(BOT_ID, BOT_USERNAME, BOT_AVATAR);

          // Mark both ready and start
          room.table.players.forEach(p => p.isReady = true);
          room.gameStarted = true;
          room.gameStartedAt = Date.now();
          room.table._onTimerAction = () => { broadcastStateGlobal(io, pin); };

          socket.emit('quick-match-bot', {
            pin,
            message: '😔 Désolé, personne n\'a été trouvé. Tu joues contre Bluffy Bot !'
          });

          room.table.startHand();
          broadcastStateGlobal(io, pin);
          io.to(`room:${pin}`).emit('game-event', { type: 'hand-start', handNumber: room.table.handNumber });

          // Kick off bot AI if bot goes first
          const firstPlayer = room.table.players[room.table.currentPlayerIndex];
          if (firstPlayer && firstPlayer.id === BOT_ID) scheduleBotAction(io, pin, room);
        }, QUICKMATCH_TIMEOUT);

        quickQueue.push({ userId: user.id, username: user.username, avatar: user.avatar, socketId: socket.id, variant, botTimer });
        callback?.({ queued: true });
      }
    });

    socket.on('cancel-quick-match', (callback) => {
      const idx = quickQueue.findIndex(q => q.userId === user.id);
      if (idx !== -1) {
        clearTimeout(quickQueue[idx].botTimer);
        quickQueue.splice(idx, 1);
      }
      callback?.({ success: true });
    });

    socket.on('create-room', (settings, callback) => {
      try {
        if (socket.data.currentPin) {
          roomManager.leaveRoom(socket.data.currentPin, user.id);
          socket.leave(`room:${socket.data.currentPin}`);
        }

        const { pin, room } = roomManager.createRoom(user.id, user.username, user.avatar, settings);
        socket.data.currentPin = pin;
        socket.join(`room:${pin}`);

        // Immediate broadcast to set client state
        broadcastState(pin);

        callback({ success: true, pin, state: room.table.getStateForPlayer(user.id) });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('join-room', (pin, callback) => {
      try {
        if (socket.data.currentPin) {
          roomManager.leaveRoom(socket.data.currentPin, user.id);
          socket.leave(`room:${socket.data.currentPin}`);
        }

        const result = roomManager.joinRoom(pin, user.id, user.username, user.avatar);
        if (result.error) return callback({ error: result.error });

        socket.data.currentPin = pin;
        socket.join(`room:${pin}`);

        // Notify others
        socket.to(`room:${pin}`).emit('player-joined', {
          player: { id: user.id, username: user.username, avatar: user.avatar }
        });

        // Send state to joiner
        broadcastState(pin);

        // Si rejoint en cours de partie, informer le joueur
        if (result.sittingOut) {
          socket.emit('game-event', {
            type: 'sitting-out',
            message: `Tu rejoins en cours de partie. Tu joueras à partir de la prochaine main !`
          });
        } else if (result.reconnected) {
          socket.emit('game-event', {
            type: 'reconnected',
            message: `Bienvenue de retour !`
          });
        }

        callback({ success: true, pin, state: result.room.table.getStateForPlayer(user.id) });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('leave-room', (callback) => {
      let pin = socket.data.currentPin;
      let room = pin ? roomManager.getRoom(pin) : null;
      if (!room) {
        room = roomManager.getRoomByPlayerId(user.id);
        if (room) {
          pin = room.pin;
          socket.data.currentPin = pin;
          socket.join(`room:${pin}`);
        } else {
          return callback?.({ error: 'Pas dans un salon' });
        }
      }

      const result = roomManager.leaveRoom(pin, user.id);
      socket.to(`room:${pin}`).emit('player-left', { playerId: user.id, username: user.username });

      if (result?.newHostId) {
        io.to(`room:${pin}`).emit('host-changed', { hostId: result.newHostId });
      }

      if (!result?.deleted) {
        broadcastState(pin);
      }

      socket.leave(`room:${pin}`);
      socket.data.currentPin = null;
      callback?.({ success: true });
    });

    // ──── GAME EVENTS ────

    socket.on('set-ready', (ready) => {
      let pin = socket.data.currentPin;
      let room = pin ? roomManager.getRoom(pin) : null;
      if (!room) {
        room = roomManager.getRoomByPlayerId(user.id);
        if (room) {
          pin = room.pin;
          socket.data.currentPin = pin;
          socket.join(`room:${pin}`);
        } else {
          return;
        }
      }

      room.table.setReady(user.id, ready);
      broadcastState(pin);
    });

    socket.on('start-game', (callback) => {
      let pin = socket.data.currentPin;
      let room = pin ? roomManager.getRoom(pin) : null;
      if (!room) {
        room = roomManager.getRoomByPlayerId(user.id);
        if (room) {
          pin = room.pin;
          socket.data.currentPin = pin;
          socket.join(`room:${pin}`);
        } else {
          return callback?.({ error: 'Salon introuvable' });
        }
      }

      if (room.hostId !== user.id) return callback?.({ error: 'Seul l\'hôte peut lancer la partie' });

      if (!room.table.canStart()) {
        return callback?.({ error: 'Tous les joueurs doivent être prêts (minimum 2)' });
      }

      room.gameStarted = true;
      room.gameStartedAt = Date.now();

      // Set up timer callback
      room.table._onTimerAction = () => {
        broadcastState(pin);
        io.to(`room:${pin}`).emit('game-event', {
          type: 'timeout',
          message: 'Temps écoulé — action automatique'
        });
      };

      const result = room.table.startHand();
      if (!result) return callback?.({ error: 'Impossible de démarrer — minimum 2 joueurs avec des jetons' });

      broadcastState(pin);
      io.to(`room:${pin}`).emit('game-event', {
        type: 'hand-start',
        handNumber: room.table.handNumber
      });

      callback?.({ success: true });
    });

    socket.on('player-action', (data, callback) => {
      let pin = socket.data.currentPin;
      let room = pin ? roomManager.getRoom(pin) : null;
      if (!room) {
        room = roomManager.getRoomByPlayerId(user.id);
        if (room) {
          pin = room.pin;
          socket.data.currentPin = pin;
          socket.join(`room:${pin}`);
        } else {
          return callback?.({ error: 'Salon introuvable' });
        }
      }

      const { action, amount } = data;
      const result = room.table.handleAction(user.id, action, amount);

      if (result.error) return callback?.({ error: result.error });

      // Capture pin now (socket.data.currentPin peut changer dans les callbacks async)
      const localPin = pin;

      // Emit action event
      io.to(`room:${localPin}`).emit('game-event', {
        type: 'action',
        playerId: user.id,
        username: user.username,
        action,
        amount: result.amount || 0
      });

      // If showdown, handle results
      if (result.phase === 'showdown') {
        io.to(`room:${localPin}`).emit('showdown', {
          winners: result.winners,
          playerHands: result.playerHands,
          pot: result.pot,
          communityCards: result.communityCards
        });

        // Persist hand results
        persistHandResult(localPin, room, result);

        // Auto-start next hand after delay
        setTimeout(() => {
          const currentRoom = roomManager.getRoom(localPin);
          if (!currentRoom) return;
          if (currentRoom.table.players.filter(p => !p.disconnected && p.chips > 0).length >= 2) {

            // Check if we need to vote for blinds (every 5 hands or requested)
            if ((currentRoom.table.handNumber > 0 && currentRoom.table.handNumber % 5 === 0) || currentRoom.table.blindsVoteRequested) {
              currentRoom.table.onBlindsVoteResolved = () => {
                currentRoom.table.startHand();
                broadcastState(localPin);
                io.to(`room:${localPin}`).emit('game-event', {
                  type: 'hand-start',
                  handNumber: currentRoom.table.handNumber
                });
              };
              currentRoom.table.startBlindsVote();
              broadcastState(localPin);
            } else {
              currentRoom.table.startHand();
              broadcastState(localPin);
              io.to(`room:${localPin}`).emit('game-event', {
                type: 'hand-start',
                handNumber: currentRoom.table.handNumber
              });
            }

          } else {
            // Game over
            currentRoom.restartVotes = new Set();
            io.to(`room:${localPin}`).emit('game-over', {
              winner: currentRoom.table.players.find(p => p.chips > 0),
              players: currentRoom.table.players.map(p => ({ username: p.username, chips: p.chips })),
              roundsPlayed: currentRoom.table.handNumber
            });
            persistGameEnd(localPin, currentRoom);
          }
        }, 5000);
      }

      // If phase advanced (to flop, turn, river OR discard phase)
      if (result.phase || result.waitingForDiscard) {
        io.to(`room:${localPin}`).emit('game-event', {
          type: 'phase-change',
          phase: room.table.phase
        });

        // If it's a discard phase, notify bots
        if (room.table.phase === 'discardWait') {
          const hasBot = room.table.players.some(p => p.id === BOT_ID && !p.folded && !p.hasDiscarded && p.chips > 0);
          if (hasBot) scheduleBotAction(io, localPin, room);
        }
      }

      broadcastState(localPin);

      // If bot is next, schedule its action
      const nextP = room.table.players[room.table.currentPlayerIndex];
      if (nextP && nextP.id === BOT_ID) scheduleBotAction(io, localPin, room);

      callback?.({ success: true });
    });

    socket.on('discard-cards', (keptCards, callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room) return callback?.({ error: 'Salon introuvable' });
      const localPin = socket.data.currentPin;

      const result = room.table.playerDiscard(user.id, keptCards);

      if (result.error) return callback?.({ error: result.error });

      io.to(`room:${localPin}`).emit('game-event', {
        type: 'action',
        playerId: user.id,
        username: user.username,
        action: 'discard',
        amount: 0
      });

      broadcastState(localPin);

      if (result.phaseChange) {
        io.to(`room:${localPin}`).emit('game-event', {
          type: 'phase-change',
          phase: room.table.phase
        });

        if (result.advanceResult?.phase === 'showdown') {
          const adv = result.advanceResult;
          io.to(`room:${localPin}`).emit('showdown', {
            winners: adv.winners,
            playerHands: adv.playerHands,
            pot: adv.pot,
            communityCards: adv.communityCards
          });

          // Persist stats depuis discard-showdown aussi
          persistHandResult(localPin, room, adv);

          // Auto-start next hand
          setTimeout(() => {
            const currentRoom = roomManager.getRoom(localPin);
            if (!currentRoom) return;
            if (currentRoom.table.players.filter(p => !p.disconnected && p.chips > 0).length >= 2) {
              currentRoom.table.startHand();
              broadcastState(localPin);
              io.to(`room:${localPin}`).emit('game-event', { type: 'hand-start', handNumber: currentRoom.table.handNumber });

              // If bot is next player in the new hand
              const firstP = currentRoom.table.players[currentRoom.table.currentPlayerIndex];
              if (firstP && firstP.id === BOT_ID) scheduleBotAction(io, localPin, currentRoom);
            }
          }, 8000);
        } else {
          // Normal phase change (to flop or turn), check if it's bot turn
          const nextP = room.table.players[room.table.currentPlayerIndex];
          if (nextP && nextP.id === BOT_ID) scheduleBotAction(io, localPin, room);
        }
      } else {
        // Still in discard phase, check if other bots need to discard
        const hasBot = room.table.players.some(p => p.id === BOT_ID && !p.folded && !p.hasDiscarded && p.chips > 0);
        if (hasBot) scheduleBotAction(io, localPin, room);
      }

      callback?.({ success: true });
    });

    socket.on('next-hand', (callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room || room.hostId !== user.id) return callback?.({ error: 'Non autorisé' });

      if (room.table.phase === 'waiting') {
        const result = room.table.startHand();
        if (result) {
          broadcastState(socket.data.currentPin);
          io.to(`room:${socket.data.currentPin}`).emit('game-event', {
            type: 'hand-start',
            handNumber: room.table.handNumber
          });
        }
      }
      callback?.({ success: true });
    });

    socket.on('vote-restart', (callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room) return callback?.({ error: 'Salon introuvable' });

      // Ensure set exists
      if (!room.restartVotes) room.restartVotes = new Set();
      room.restartVotes.add(user.id);

      const activePlayers = room.table.players.filter(p => !p.disconnected);
      const totalRequired = activePlayers.length;

      // Emit the vote update
      io.to(`room:${socket.data.currentPin}`).emit('restart-votes-updated', {
        votesCount: room.restartVotes.size,
        totalRequired: totalRequired
      });

      // If everyone active voted, auto restart
      if (room.restartVotes.size >= totalRequired) {
        room.gameStarted = true;
        room.gameStartedAt = Date.now();
        room.table.resetForNewGame();
        room.restartVotes.clear();

        // Auto start the first hand
        room.table.startHand();

        // Broadcast new state and explicit game-restarted event
        io.to(`room:${socket.data.currentPin}`).emit('game-restarted');
        io.to(`room:${socket.data.currentPin}`).emit('game-event', {
          type: 'hand-start',
          handNumber: room.table.handNumber
        });
        broadcastState(socket.data.currentPin);
      }

      callback?.({ success: true });
    });

    socket.on('request-blinds-vote', (callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room || !room.table) return callback?.({ error: 'Partie non trouvée' });

      room.table.blindsVoteRequested = true;
      broadcastState(socket.data.currentPin);
      callback?.({ success: true });
    });

    socket.on('vote-blinds', (voteChoice, callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room || !room.table) return callback?.({ error: 'Partie non trouvée' });

      const result = room.table.voteBlinds(user.id, voteChoice);
      if (result.error) return callback?.({ error: result.error });

      broadcastState(socket.data.currentPin);
      callback?.({ success: true });
    });

    // ──── SETTINGS ────

    socket.on('update-settings', (settings, callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room || room.hostId !== user.id) return callback?.({ error: 'Non autorisé' });
      if (room.gameStarted) return callback?.({ error: 'Impossible de modifier en cours de partie' });

      Object.assign(room.table.settings, settings);
      broadcastState(socket.data.currentPin);
      callback?.({ success: true });
    });

    socket.on('kick-player', (playerId, callback) => {
      if (!socket.data.currentPin) return callback?.({ error: 'Pas dans un salon' });
      const room = roomManager.getRoom(socket.data.currentPin);
      if (!room || room.hostId !== user.id) return callback?.({ error: 'Non autorisé' });

      roomManager.leaveRoom(socket.data.currentPin, playerId);
      io.to(`room:${socket.data.currentPin}`).emit('player-kicked', { playerId });
      broadcastState(socket.data.currentPin);
      callback?.({ success: true });
    });

    // ──── CHAT ────

    socket.on('chat-message', (message) => {
      if (!socket.data.currentPin || !message?.trim()) return;
      const msg = roomManager.addChatMessage(socket.data.currentPin, user.id, user.username, message);
      if (msg) io.to(`room:${socket.data.currentPin}`).emit('chat-message', msg);
    });

    // ──── DISCONNECT ────

    socket.on('disconnect', () => {
      console.log(`  ⚡ ${user.username} disconnected`);
      // Remove from quickmatch queue if waiting
      const qIdx = quickQueue.findIndex(q => q.userId === user.id);
      if (qIdx !== -1) { clearTimeout(quickQueue[qIdx].botTimer); quickQueue.splice(qIdx, 1); }
      if (socket.data.currentPin) {
        const room = roomManager.getRoom(socket.data.currentPin);
        if (room) {
          const localPin = socket.data.currentPin;
          const result = roomManager.leaveRoom(localPin, user.id);
          socket.to(`room:${localPin}`).emit('player-left', {
            playerId: user.id,
            username: user.username,
            disconnected: true
          });

          if (result?.newHostId) {
            io.to(`room:${localPin}`).emit('host-changed', { hostId: result.newHostId });
          }
          if (!result?.deleted) {
            broadcastState(localPin);
          }
        }
      }
    });

    // ──── HELPERS ────

    function broadcastState(pin) {
      const room = roomManager.getRoom(pin);
      if (!room) return;

      // Send personalized state to each player
      const sockets = io.sockets.adapter.rooms.get(`room:${pin}`);
      if (!sockets) return;

      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (s?.user) {
          s.emit('game-state', {
            ...room.table.getStateForPlayer(s.user.id),
            hostId: room.hostId,
            pin,
            chat: room.chat.slice(-20),
            actions: room.table.getAvailableActions(s.user.id)
          });
        }
      }
    }

    async function persistHandResult(pin, room, result) {
      try {
        for (const winner of result.winners) {
          if (winner.playerId === BOT_ID) continue;
          await User.findByIdAndUpdate(winner.playerId, {
            $inc: {
              'stats.handsWon': 1,
              'stats.totalEarnings': winner.amount || 0
            },
            $max: { 'stats.biggestPot': result.pot }
          });
        }

        const pStats = result.playerStats || [];
        for (const pst of pStats) {
          if (pst.playerId === BOT_ID) continue;
          const hs = pst.handStats;
          if (!hs) continue;

          let wssdInc = 0;
          if (hs.wtsd) {
            const won = result.winners.some(w => w.playerId === pst.playerId);
            if (won) wssdInc = 1;
          }

          await User.findByIdAndUpdate(pst.playerId, {
            $inc: {
              'stats.handsPlayed': 1,
              'stats.handsDealt': 1,
              'stats.pfrCount': hs.pfr ? 1 : 0,
              'stats.vpipCount': hs.vpip ? 1 : 0,
              'stats.atsOpportunities': hs.atsOpp ? 1 : 0,
              'stats.atsCount': hs.atsAttempt ? 1 : 0,
              'stats.wtsdCount': hs.wtsd ? 1 : 0,
              'stats.wssdCount': wssdInc,
              'stats.aggrBets': hs.aggrBets || 0,
              'stats.aggrCalls': hs.aggrCalls || 0
            }
          });
        }
      } catch (err) {
        console.error('  ✗ Error persisting hand:', err.message);
      }
    }


    async function persistGameEnd(pin, room) {
      try {
        const players = room.table.players;
        const winner = players.find(p => p.chips > 0);

        const history = new GameHistory({
          roomPin: pin,
          players: players.map(p => ({
            userId: p.id,
            username: p.username,
            finalChips: p.chips,
            handsWon: 0,
            biggestPot: 0
          })),
          winnerId: winner?.id,
          winnerUsername: winner?.username,
          totalHands: room.table.handNumber,
          settings: room.table.settings,
          startedAt: room.gameStartedAt,
          endedAt: new Date(),
          duration: Math.floor((Date.now() - room.gameStartedAt) / 1000)
        });
        await history.save();

        // ── Base stats update ──
        for (const p of players) {
          if (p.id === BOT_ID) continue;
          const won = p.chips > 0;
          await User.findByIdAndUpdate(p.id, {
            $inc: {
              'stats.gamesPlayed': 1,
              'stats.gamesWon': won ? 1 : 0
            }
          });
        }

        // ── ELO update (ranked only) ──
        if (room.table.settings?.mode === 'ranked' && winner) {
          // Fetch current ELO for all players
          const userDocs = await User.find(
            { _id: { $in: players.filter(p => p.id !== BOT_ID).map(p => p.id) } },
            { _id: 1, elo: 1 }
          );
          const eloMap = Object.fromEntries(
            userDocs.map(u => [u._id.toString(), u.elo ?? 0])
          );

          const input = players.map(p => ({ id: p.id, elo: eloMap[p.id] || 0 }));
          const changes = computeEloChanges(input, winner.id);

          for (const c of changes) {
            const won = c.id === winner.id;
            await User.findByIdAndUpdate(c.id, {
              $set: { elo: c.newElo },
              $max: { 'ranked.peakElo': c.newElo },
              $inc: {
                'ranked.gamesPlayed': 1,
                'ranked.gamesWon': won ? 1 : 0
              }
            });
            console.log(`  🏆 ELO ${c.id}: ${c.oldElo} → ${c.newElo} (${c.delta >= 0 ? '+' : ''}${c.delta})`);
          }
        }
      } catch (err) {
        console.error('  ✗ Error persisting game:', err.message);
      }
    }
  });
}
