# 📖 Technical Documentation - Bluffy.me

This document provides a deep dive into the architecture, logic, and communication protocols of the Bluffy.me poker platform.

---

## 🏗️ Architecture Overview

Bluffy.me follows a **Client-Server** architecture with real-time state synchronization via **WebSockets (Socket.io)**.

- **State Ownership**: The server is the single source of truth for the game state. Clients send actions (e.g., 'call', 'fold') and receive partial state updates.
- **Privacy**: The server sanitizes the game state for each player, ensuring that hole cards of opponents are hidden unless the game reaches the "showdown" phase.

---

## 🔌 Socket.io API

### 🏠 Room Events

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `create-room` | Client -> Server | `{ settings: Object }` | Creates a new private room. |
| `join-room` | Client -> Server | `pin: String` | Joins a room using a 4-digit PIN. |
| `leave-room` | Client -> Server | - | Leaves the current room. |
| `quick-match` | Client -> Server | `variantId: String` | Enters the matchmaking queue. |
| `player-joined` | Server -> Client | `{ player: Object }` | Broadcasted when a new player joins. |
| `player-left` | Server -> Client | `{ playerId: String }` | Broadcasted when a player leaves. |

### 🃏 Game Events

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `start-game` | Client -> Server | - | Starts the match (Host only). |
| `player-action` | Client -> Server | `{ action: String, amount: Number }` | Executes a poker action. |
| `discard-cards` | Client -> Server | `[Card, Card]` | Used in Pineapple/Irish variants. |
| `game-state` | Server -> Client | `Object` | Personalized state update for the player. |
| `game-event` | Server -> Client | `{ type: String, message: String }` | Generic notifications (e.g., "Hand started"). |
| `showdown` | Server -> Client | `Object` | Final results and revealed hands. |

---

## 🧠 Game Logic

### Room Management (`RoomManager.js`)
Handles the lifecycle of game rooms, PIN generation, and player mapping. It ensures that rooms are cleaned up after 3 hours of inactivity.

### The Poker Table (`Table.js`)
The core engine of the game. It manages:
1. **Phases**: `waiting`, `preflop`, `flop`, `turn`, `river`, `showdown`.
2. **Betting Logic**: Calculates pot, side pots, minimum raises, and enforces player turns.
3. **Variant Rules**:
   - **Pineapple**: Deals 3 hole cards, requires discard before the flop.
   - **Irish**: Deals 4 hole cards, requires discard after the flop.
   - **Courchevel**: Deals 5 hole cards, reveals the first community card pre-flop.

### Hand Evaluation (`HandEvaluator.js`)
Uses a optimized algorithm to rank poker hands (from High Card to Royal Flush) based on the specific rules of each variant.

---

## 🗄️ Database Schema

### User Model
- `username`: Unique player name.
- `email`: Authenticated email.
- `password`: Hashed via Bcrypt.
- `stats`:
  - `handsWon`: Total number of hands won.
  - `totalEarnings`: Cumulative chips earned.
  - `elo`: Skill rating for matchmaking.

### Game History
Stores anonymized records of completed games for historical analysis and leaderboard calculation.

---

## 🤖 Bot System

The bot system (`gameHandler.js`) is designed to simulate human-like behavior:
- **Delay**: Random delays between 800ms and 2000ms are added to actions.
- **Skill Level**: A metric based on hand strength and a "skill" factor determines whether a bot folds, calls, or raises.
- **Auto-Fill**: In Quick Match mode, a bot is automatically added if no human opponent is found within 5 seconds.

---

## 🎨 Styling System

Styles are implemented using **Vanilla CSS** with a robust set of variables defined in `Global.css`.
- **Glassmorphism**: Heavy use of `backdrop-filter: blur()` and semi-transparent backgrounds.
- **Responsiveness**: Mobile-first design with specific breakpoints for tablet and desktop poker layouts.
- **Themes**: Table themes (Classic, Emerald, Diamond, Obsidian) are applied via class-based theme injection on the `.poker-table` element.
