import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
      return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: user.toPublic()
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Cet email ou nom d\'utilisateur existe déjà' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    const user = await User.findOne({
      $or: [{ email: login.toLowerCase() }, { username: login }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: user.toPublic()
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user.toPublic() });
});

// Update avatar
router.patch('/avatar', authMiddleware, async (req, res) => {
  try {
    const { avatar } = req.body;
    req.user.avatar = avatar;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update table theme (cosmetic)
router.patch('/table-theme', authMiddleware, async (req, res) => {
  try {
    const VALID_THEMES = ['default', 'bronze', 'silver', 'gold', 'diamond', 'legend'];
    const { tableTheme } = req.body;
    if (!VALID_THEMES.includes(tableTheme)) {
      return res.status(400).json({ error: 'Thème invalide' });
    }
    req.user.tableTheme = tableTheme;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
