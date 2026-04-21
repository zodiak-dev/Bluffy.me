import { Table } from './Table.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generatePin() {
    let pin;
    do {
      pin = String(Math.floor(1000 + Math.random() * 9000));
    } while (this.rooms.has(pin));
    return pin;
  }

  createRoom(hostId, hostUsername, hostAvatar, settings = {}) {
    const pin = this.generatePin();
    const room = {
      pin,
      hostId,
      table: new Table(settings),
      chat: [],
      createdAt: Date.now(),
      gameStarted: false,
      gameStartedAt: null
    };

    room.table.addPlayer(hostId, hostUsername, hostAvatar);
    this.rooms.set(pin, room);

    return { pin, room };
  }

  joinRoom(pin, playerId, username, avatar) {
    const room = this.rooms.get(pin);
    if (!room) return { error: 'Salon introuvable' };

    // Reconnection: player already in the table
    const existingPlayer = room.table.players.find(p => p.id === playerId);
    if (existingPlayer) {
      existingPlayer.disconnected = false;
      // If game is active, keep them folded until next hand
      return { room, player: existingPlayer, reconnected: true };
    }

    // New player joining mid-game -> waits for next hand
    const midGame = room.gameStarted && room.table.phase !== 'waiting';
    const player = room.table.addPlayer(playerId, username, avatar, { sittingOut: midGame });
    if (!player) return { error: 'Room is full' };

    return { room, player, sittingOut: midGame };
  }

  leaveRoom(pin, playerId) {
    const room = this.rooms.get(pin);
    if (!room) return;

    room.table.removePlayer(playerId);

    // Transfer host if needed
    const remaining = room.table.players.filter(p => !p.disconnected);
    if (remaining.length === 0) {
      room.table.destroy();
      this.rooms.delete(pin);
      return { deleted: true };
    }

    if (room.hostId === playerId) {
      room.hostId = remaining[0].id;
      return { newHostId: remaining[0].id };
    }

    return {};
  }

  getRoom(pin) {
    return this.rooms.get(pin);
  }

  getRoomByPlayerId(playerId) {
    for (const [pin, room] of this.rooms) {
      if (room.table.players.find(p => p.id === playerId)) {
        return { pin, room };
      }
    }
    return null;
  }

  addChatMessage(pin, userId, username, message) {
    const room = this.rooms.get(pin);
    if (!room) return;

    const msg = {
      userId,
      username,
      message: message.substring(0, 200),
      timestamp: Date.now()
    };
    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.shift();
    return msg;
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 3 * 60 * 60 * 1000; // 3 hours
    for (const [pin, room] of this.rooms) {
      if (now - room.createdAt > maxAge) {
        room.table.destroy();
        this.rooms.delete(pin);
      }
    }
  }
}

export default new RoomManager();
