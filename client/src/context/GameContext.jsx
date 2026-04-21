import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [showdown, setShowdown] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [restartVotes, setRestartVotes] = useState({ count: 0, total: 0 });
  const [events, setEvents] = useState([]);
  const [chat, setChat] = useState([]);
  const [botMessage, setBotMessage] = useState(null); // message bot quickmatch

  useEffect(() => {
    if (!socket) return;

    socket.on('game-state', (state) => {
      setGameState(state);
      if (state.chat) setChat(state.chat);
    });

    socket.on('showdown', (data) => {
      setShowdown(data);
      setTimeout(() => setShowdown(null), 5000);
    });

    socket.on('game-event', (event) => {
      setEvents(prev => [...prev.slice(-49), { ...event, id: Date.now() }]);
    });

    socket.on('chat-message', (msg) => {
      setChat(prev => [...prev.slice(-99), msg]);
    });

    socket.on('player-kicked', (data) => {
      // Handle being kicked
    });

    socket.on('game-over', (data) => {
      setGameOver(data);
      setEvents(prev => [...prev, {
        type: 'game-over',
        message: `${data.winner?.username || 'Quelqu\'un'} remporte la partie !`,
        id: Date.now()
      }]);
    });

    socket.on('game-restarted', () => {
      setGameOver(null);
      setRestartVotes({ count: 0, total: 0 });
      setEvents(prev => [...prev, {
        type: 'game-restart',
        message: 'La partie a été réinitialisée',
        id: Date.now()
      }]);
    });

    socket.on('restart-votes-updated', (data) => {
      setRestartVotes({ count: data.votesCount, total: data.totalRequired });
    });

    // Quick match events
    socket.on('quick-match-bot', (data) => {
      setBotMessage(data.message);
      setTimeout(() => setBotMessage(null), 6000);
    });

    return () => {
      socket.off('game-state');
      socket.off('showdown');
      socket.off('game-event');
      socket.off('chat-message');
      socket.off('player-kicked');
      socket.off('game-over');
      socket.off('game-restarted');
      socket.off('restart-votes-updated');
      socket.off('quick-match-bot');
    };
  }, [socket]);

  const createRoom = useCallback((settings = {}) => {
    return new Promise((resolve) => {
      socket?.emit('create-room', settings, resolve);
    });
  }, [socket]);

  const joinRoom = useCallback((pin) => {
    return new Promise((resolve) => {
      socket?.emit('join-room', pin, resolve);
    });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    return new Promise((resolve) => {
      socket?.emit('leave-room', resolve);
      setGameState(null);
      setShowdown(null);
      setGameOver(null);
      setRestartVotes({ count: 0, total: 0 });
      setEvents([]);
      setChat([]);
    });
  }, [socket]);

  const setReady = useCallback((ready) => {
    socket?.emit('set-ready', ready);
  }, [socket]);

  const startGame = useCallback(() => {
    return new Promise((resolve) => {
      socket?.emit('start-game', resolve);
    });
  }, [socket]);

  const voteRestart = useCallback(() => {
    socket.emit('vote-restart', (res) => {
      if (res.error) console.error(res.error);
    });
  }, [socket]);

  const requestBlindsVote = useCallback(() => {
    socket.emit('request-blinds-vote', (res) => {
      if (res.error) console.error(res.error);
    });
  }, [socket]);

  const voteBlinds = useCallback((choice) => {
    socket.emit('vote-blinds', choice, (res) => {
      if (res.error) console.error(res.error);
    });
  }, [socket]);

  const playerAction = useCallback((action, amount) => {
    return new Promise((resolve) => {
      socket?.emit('player-action', { action, amount }, resolve);
    });
  }, [socket]);

  const sendChat = useCallback((message) => {
    socket?.emit('chat-message', message);
  }, [socket]);

  const updateSettings = useCallback((settings) => {
    return new Promise((resolve) => {
      socket?.emit('update-settings', settings, resolve);
    });
  }, [socket]);

  const kickPlayer = useCallback((playerId) => {
    return new Promise((resolve) => {
      socket?.emit('kick-player', playerId, resolve);
    });
  }, [socket]);

  const quickMatch = useCallback((variantId) => {
    return new Promise((resolve) => {
      socket?.emit('quick-match', variantId, resolve);
    });
  }, [socket]);

  const cancelQuickMatch = useCallback(() => {
    return new Promise((resolve) => {
      socket?.emit('cancel-quick-match', resolve);
    });
  }, [socket]);

  return (
    <GameContext.Provider value={{
      gameState, showdown, gameOver, restartVotes, events, chat, botMessage,
      createRoom, joinRoom, leaveRoom,
      setReady, startGame, voteRestart, playerAction,
      sendChat, updateSettings, kickPlayer, requestBlindsVote, voteBlinds,
      quickMatch, cancelQuickMatch
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
