import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import User from './models/User.js';
import Auction from './models/Auction.js';
import authRoutes from './routes/auth.js';
import auctionRoutes from './routes/auctions.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { BidError, placeBid, presentAuction, publishAuction } from './services/auctionService.js';
import { seedData } from './seed.js';

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 4000);
app.set('trust proxy', 1);
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:4000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters in production.');
}
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'local-development-secret-change-this-before-deploying';

const checkOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  const error = new Error('This origin is not allowed by CORS.');
  error.status = 403;
  return callback(error);
};

const io = new Server(server, {
  cors: { origin: checkOrigin, credentials: true },
  pingInterval: 25000,
  pingTimeout: 20000,
});
app.set('io', io);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'https:'] } },
}));
app.use(cors({ origin: checkOrigin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 35, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', database: connected ? 'connected' : 'disconnected' });
});
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(rootDir, '../dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.code === 11000 ? 409 : err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
  res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong.' : (err.message || 'Something went wrong.') });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) { socket.data.user = null; return next(); }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = await User.findById(payload.sub).select('username email role');
    if (!socket.data.user) return next(new Error('Account is no longer available.'));
    next();
  } catch {
    next(new Error('Invalid or expired session.'));
  }
});

async function updatePresence(auctionId) {
  const room = `auction:${auctionId}`;
  try {
    const clients = await io.in(room).fetchSockets();
    io.to(room).emit('auction:presence', { auctionId, count: clients.length });
  } catch (error) { console.error('Presence update failed:', error.message); }
}

io.on('connection', (socket) => {
  socket.on('auction:join', async (auctionId) => {
    if (!mongoose.isValidObjectId(auctionId)) return socket.emit('auction:error', { message: 'Invalid auction id.' });
    const auction = await Auction.findById(auctionId).catch(() => null);
    if (!auction) return socket.emit('auction:error', { message: 'Auction not found.' });
    socket.join(`auction:${auctionId}`);
    socket.data.auctionId = String(auctionId);
    socket.emit('auction:snapshot', presentAuction(auction));
    updatePresence(String(auctionId));
  });

  socket.on('auction:bid', async (payload = {}, acknowledge = () => {}) => {
    if (!socket.data.user) return acknowledge({ ok: false, error: 'Sign in before placing a bid.' });
    if (!mongoose.isValidObjectId(payload.auctionId)) return acknowledge({ ok: false, error: 'Invalid auction id.' });
    try {
      const auction = await placeBid({ auctionId: payload.auctionId, user: socket.data.user, amount: payload.amount });
      publishAuction(io, auction);
      acknowledge({ ok: true, auction });
    } catch (error) {
      if (error instanceof BidError) return acknowledge({ ok: false, error: error.message, auction: error.latestAuction });
      console.error('Socket bid failed:', error);
      acknowledge({ ok: false, error: 'Could not place your bid right now.' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.auctionId) updatePresence(socket.data.auctionId);
  });
});

async function endExpiredAuctions() {
  const expired = await Auction.find({ status: 'active', endsAt: { $lte: new Date() } });
  if (!expired.length) return;
  await Auction.updateMany({ _id: { $in: expired.map((item) => item._id) } }, { $set: { status: 'ended' } });
  for (const item of expired) {
    item.status = 'ended';
    publishAuction(io, presentAuction(item));
  }
}

const memoryDatabase = await connectDatabase();
await seedData();
await endExpiredAuctions();
setInterval(() => endExpiredAuctions().catch((error) => console.error('Auction expiry check failed:', error)), 30000).unref();
server.listen(port, () => console.info(`Gavel & Grain listening on port ${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => {
    await mongoose.disconnect();
    await memoryDatabase?.stop();
    process.exit(0);
  }));
}
