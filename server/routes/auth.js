import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { makeToken, requireAuth } from '../middleware/auth.js';
import { isEmailConfigured, sendTestEmail } from '../services/emailService.js';

const router = Router();
const safeUser = (user) => ({ id: String(user._id), username: user.username, email: user.email, role: user.role });

router.post('/register', asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'buyer');
  if (username.length < 2 || username.length > 32) return res.status(400).json({ error: 'Name must be between 2 and 32 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be between 8 and 72 characters.' });
  if (!['buyer', 'bidder', 'seller'].includes(role)) return res.status(400).json({ error: 'Choose a buyer, bidder, or seller account.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with that email already exists.' });

  const user = await User.create({ username, email, passwordHash: await bcrypt.hash(password, 12), role });
  res.status(201).json({ token: makeToken(user), user: safeUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be between 8 and 72 characters.' });
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: makeToken(user), user: safeUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

router.post('/email-test', requireAuth, asyncHandler(async (req, res) => {
  if (!isEmailConfigured()) {
    return res.status(503).json({ error: 'Email is not configured on the API server. Add RESEND_API_KEY and EMAIL_FROM, then restart the server.' });
  }
  const sent = await sendTestEmail(req.user);
  if (!sent) {
    return res.status(502).json({ error: 'The email provider did not accept the test message. Check the sender verification and API server logs.' });
  }
  return res.json({ message: `Test email accepted for ${req.user.email}. Check that inbox and its spam folder.` });
}));

export default router;
