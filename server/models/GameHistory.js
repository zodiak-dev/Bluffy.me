import mongoose from 'mongoose';

const gameHistorySchema = new mongoose.Schema({
  roomPin: String,
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    finalChips: Number,
    handsWon: Number,
    biggestPot: Number
  }],
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerUsername: String,
  totalHands: { type: Number, default: 0 },
  settings: {
    mode: String,
    smallBlind: Number,
    bigBlind: Number,
    startingChips: Number
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  duration: Number // in seconds
});

export default mongoose.model('GameHistory', gameHistorySchema);
