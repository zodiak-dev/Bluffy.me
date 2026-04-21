# 🃏 Bluffy.me

<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-success?style=for-the-badge&logo=statuspage" alt="Live Status">
  <img src="https://img.shields.io/badge/Language-French_Only-red?style=for-the-badge&logo=google-translate" alt="Language">
  <img src="https://img.shields.io/badge/Multiplayer-Real--Time-blueviolet?style=for-the-badge&logo=socket.io" alt="Multiplayer">
</p>

<p align="center">
  <strong>WebJS Real-Time Multiplayer Poker</strong><br>
  🌍 Live Version: <a href="https://bluffy.me">https://bluffy.me</a>
</p>

> [!IMPORTANT]
> **Note on Language**: The current version of Bluffy.me is available **exclusively in French**.

**Bluffy.me** is a high-performance, real-time multiplayer poker platform designed for a seamless and immersive gaming experience. Built with a modern tech stack, it features multiple poker variants, a robust betting system, and smart bot integration.

---

## 📸 Visual Previews

<p align="center">
  <img src="https://i.imgur.com/wQtC6e5.png" width="800" alt="Screen 1">
</p>

<p align="center">
  <img src="https://i.imgur.com/w5wqpYP.png" width="400" alt="Screen 2">
  <img src="[https://i.imgur.com/wQtC6e5.png](https://i.imgur.com/CQTejJq.png)" width="400" alt="Screen 3">
</p>

---

## ✨ Features

- **🎮 Real-time Multiplayer**: Low-latency gameplay powered by Socket.io.
- **🃏 Multiple Variants**:
  - **Texas Hold'em**: The classic experience.
  - **Pineapple**: Start with 3 cards, discard 1 before the flop.
  - **Irish**: Start with 4 cards, discard 2 after the flop.
  - **Courchevel**: 5 cards and the first flop card revealed pre-flop.
- **🤖 Smart Bots**: Never wait for a match. Integrated bots with adjustable skill levels fill the table when needed.
- **🔒 Private Rooms**: Create custom games and invite friends via a secure 4-digit PIN.
- **📈 Player Stats**: Detailed tracking of hands won, earnings, and Elo-based rankings.
- **🎨 Customization**: Personalized table themes and cosmetics to make the experience yours.

---

## 🚀 Tech Stack

### Frontend
- <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" alt="React"> **React 18** + **Vite** for a fast, reactive UI.
- <img src="https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js&logoColor=white" alt="Three.js"> **Three.js** (React Three Fiber) for advanced visual elements.
- <img src="https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white" alt="Socket.io"> **Socket.io-client** for real-time bidirectional communication.
- <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white" alt="CSS3"> **CSS3** with a "Glassmorphism" aesthetic for a premium look.

### Backend
- <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js"> **Node.js** + **Express** server.
- <img src="https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white" alt="Socket.io"> **Socket.io** for real-time game state synchronization.
- <img src="https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white" alt="MongoDB"> **MongoDB** + **Mongoose** for persistent data storage.
- <img src="https://img.shields.io/badge/JWT-000000?style=flat&logo=json-web-tokens&logoColor=white" alt="JWT"> **JWT & Bcrypt** for secure authentication.

---

## 🛠️ Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or via Atlas)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/bluffy-me.git
   cd bluffy-me/site
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install

   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/bluffy
   JWT_SECRET=your_super_secret_key
   NODE_ENV=development
   ```

4. **Run the application**
   ```bash
   # Run both client and server in development mode
   npm run dev
   ```

---

## 📂 Project Structure

```text
site/
├── client/           # React frontend (Vite)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # State management (Auth, Game, Socket)
│   │   ├── pages/      # Route-level components
│   │   └── styles/     # Premium CSS modules
├── server/           # Node.js backend
│   ├── config/       # DB and server configuration
│   ├── game/         # Core poker logic (Table, Deck, Evaluator)
│   ├── models/       # Mongoose schemas
│   ├── routes/       # Express API endpoints
│   └── sockets/      # Socket.io event handlers
└── server.js         # Entry point
```

---

## 📜 License

This project is licensed under the GNU GPLv3 License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with ❤️ for the Poker Community</p>

---

## 👑 Created By

> ZODIAK-DEV 🚀
