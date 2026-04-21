import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: 'default'
  },
  stats: {
    gamesPlayed:    { type: Number, default: 0 },
    gamesWon:       { type: Number, default: 0 },
    totalEarnings:  { type: Number, default: 0 },
    biggestPot:     { type: Number, default: 0 },
    handsDealt:     { type: Number, default: 0 },
    handsPlayed:    { type: Number, default: 0 },
    handsWon:       { type: Number, default: 0 },
    pfrCount:       { type: Number, default: 0 },
    vpipCount:      { type: Number, default: 0 },
    atsOpportunities: { type: Number, default: 0 },
    atsCount:       { type: Number, default: 0 },
    wtsdCount:      { type: Number, default: 0 },
    wssdCount:      { type: Number, default: 0 },
    aggrBets:       { type: Number, default: 0 },
    aggrCalls:      { type: Number, default: 0 },
  },
  // ── Cosmetics ──
  tableTheme: {
    type: String,
    default: 'default',
    enum: ['default', 'bronze', 'silver', 'gold', 'diamond', 'legend']
  },
  // ── Ranked / ELO ──
  elo: { type: Number, default: 0 },          // 0 = Unranked (jamais joué en ranked)
  ranked: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon:    { type: Number, default: 0 },
    peakElo:     { type: Number, default: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublic = function() {
  return {
    id: this._id.toString(),
    username: this.username,
    avatar: this.avatar,
    tableTheme: this.tableTheme ?? 'default',
    stats: this.stats,
    elo: this.elo ?? 0,
    ranked: this.ranked,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);
