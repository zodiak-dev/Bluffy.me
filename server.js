import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './server/config/db.js';
import authRoutes from './server/routes/auth.js';
import statsRoutes from './server/routes/stats.js';
import { socketAuthMiddleware } from './server/middleware/auth.js';
import setupGameHandlers from './server/sockets/gameHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? 'https://bluffy.me' : 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://bluffy.me' : 'http://localhost:5173'
}));
app.use(express.json());

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: '🃏 Bluffy.me Poker API is running',
    version: '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Socket.IO auth middleware
io.use(socketAuthMiddleware);

// Setup game handlers
setupGameHandlers(io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3001;

console.log('\n  🃏 Bluffy.me Poker Server');
console.log('  ─────────────────────────');

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`  ✓ Server running on port ${PORT}`);
    console.log(`  ✓ Socket.IO ready`);
    console.log('  ─────────────────────────\n');
  });
});
