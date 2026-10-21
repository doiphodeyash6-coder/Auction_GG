import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { makeToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const safeUser = (user) => ({ id: String(user._id), username: user.username, email: user.email, role: user.role });

router.post('/register', asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (username.length < 2 || username.length > 32) return res.status(400).json({ error: 'Name must be between 2 and 32 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: 'Password must be between 10 and 72 characters.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with that email already exists.' });

  const user = await User.create({ username, email, passwordHash: await bcrypt.hash(password, 12), role: 'bidder' });
  res.status(201).json({ token: makeToken(user), user: safeUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: makeToken(user), user: safeUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

export default router;
