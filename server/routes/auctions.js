import { Router } from 'express';
import mongoose from 'mongoose';
import Auction from '../models/Auction.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyAuctionClosed, notifyAuctionListed } from '../services/emailService.js';
import { BidError, placeBid, presentAuction, publishAuction } from '../services/auctionService.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category && req.query.category !== 'All objects') filter.category = String(req.query.category).slice(0, 32);
  if (req.query.status === 'active' || req.query.status === 'ended') filter.status = req.query.status;
  const docs = await Auction.find(filter).sort({ status: 1, endsAt: 1 }).populate('createdBy', 'username').lean();
  res.json({ auctions: docs.map(presentAuction) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid auction id.' });
  const doc = await Auction.findById(req.params.id).populate('createdBy', 'username');
  if (!doc) return res.status(404).json({ error: 'Auction not found.' });
  res.json({ auction: presentAuction(doc) });
}));

router.post('/', requireAuth, requireRole('admin', 'seller'), asyncHandler(async (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const category = String(req.body.category || '').trim();
  const imageUrl = String(req.body.imageUrl || '/assets/ceramic-vase.svg').trim();
  const startingPrice = Number(req.body.startingPrice);
  const minIncrement = Number(req.body.minIncrement || 500);
  const durationHours = Number(req.body.durationHours || 24);
  if (title.length < 4 || title.length > 90) return res.status(400).json({ error: 'Title must be between 4 and 90 characters.' });
  if (description.length < 12 || description.length > 2000) return res.status(400).json({ error: 'Description must be between 12 and 2,000 characters.' });
  if (!category || category.length > 32) return res.status(400).json({ error: 'Choose a category.' });
  if (!Number.isSafeInteger(startingPrice) || startingPrice < 1 || !Number.isSafeInteger(minIncrement) || minIncrement < 1) return res.status(400).json({ error: 'Starting price and bid increment must be positive whole-rupee amounts.' });
  if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 720) return res.status(400).json({ error: 'Auction duration must be between 1 hour and 30 days.' });
  if (imageUrl.length > 500 || !/^(\/|https:\/\/)/.test(imageUrl)) return res.status(400).json({ error: 'Image must be a local path or an HTTPS URL.' });

  const auction = await Auction.create({
    title, description, category, imageUrl, startingPrice, currentPrice: startingPrice,
    minIncrement, endsAt: new Date(Date.now() + durationHours * 60 * 60 * 1000), createdBy: req.user._id,
  });
  const result = presentAuction(auction);
  await notifyAuctionListed({ auction: result, seller: req.user });
  req.app.get('io').emit('auction:created', result);
  res.status(201).json({ auction: result });
}));

router.post('/:id/bids', requireAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid auction id.' });
  try {
    const auction = await placeBid({ auctionId: req.params.id, user: req.user, amount: req.body.amount });
    publishAuction(req.app.get('io'), auction);
    res.status(201).json({ auction });
  } catch (error) {
    if (error instanceof BidError) return res.status(error.status).json({ error: error.message, auction: error.latestAuction });
    throw error;
  }
}));

router.post('/:id/close', requireAuth, requireRole('admin', 'seller'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid auction id.' });
  const filter = { _id: req.params.id, status: 'active' };
  if (req.user.role === 'seller') filter.createdBy = req.user._id;
  const doc = await Auction.findOneAndUpdate(filter, { $set: { status: 'ended', endsAt: new Date() } }, { new: true })
    .populate('createdBy', 'username email role')
    .populate('highestBidder', 'username email role');
  if (!doc) return res.status(404).json({ error: 'Active auction not found or you do not own it.' });
  await notifyAuctionClosed({
    auctionId: doc._id,
    title: doc.title,
    seller: doc.createdBy,
    buyer: doc.highestBidder,
    finalPrice: doc.currentPrice,
  });
  const auction = presentAuction(doc);
  publishAuction(req.app.get('io'), auction);
  res.json({ auction });
}));

export default router;
