import Auction from '../models/Auction.js';

export class BidError extends Error {
  constructor(message, status = 400, latestAuction = null) {
    super(message);
    this.status = status;
    this.latestAuction = latestAuction;
  }
}

export function presentAuction(doc) {
  if (!doc) return null;
  const auction = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...auction,
    _id: String(auction._id),
    createdBy: auction.createdBy?._id ? { _id: String(auction.createdBy._id), username: auction.createdBy.username } : auction.createdBy,
    bids: (auction.bids || []).map((bid) => ({
      ...bid,
      _id: String(bid._id),
      bidderId: bid.bidderId ? String(bid.bidderId) : null,
    })),
  };
}

export async function placeBid({ auctionId, user, amount }) {
  const numericAmount = Number(amount);
  if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) throw new BidError('Enter a valid whole-rupee bid amount.');

  const auction = await Auction.findById(auctionId);
  if (!auction) throw new BidError('Auction not found.', 404);
  if (auction.status !== 'active' || auction.endsAt <= new Date()) throw new BidError('This auction has ended.', 409, presentAuction(auction));
  const minimum = auction.currentPrice + auction.minIncrement;
  if (numericAmount < minimum) {
    throw new BidError(`The next bid must be at least ₹${minimum.toLocaleString('en-IN')}.`, 409, presentAuction(auction));
  }

  const now = new Date();
  const updated = await Auction.findOneAndUpdate(
    { _id: auction._id, currentPrice: auction.currentPrice, status: 'active', endsAt: { $gt: now } },
    {
      $set: { currentPrice: numericAmount, highestBidder: user._id, highestBidderName: user.username },
      $push: { bids: { bidderId: user._id, bidderName: user.username, amount: numericAmount, createdAt: now, updatedAt: now } },
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    const latest = await Auction.findById(auction._id);
    throw new BidError('A newer bid arrived first. Check the current price and try again.', 409, presentAuction(latest));
  }

  return presentAuction(updated);
}

export function publishAuction(io, auction) {
  if (io && auction) io.to(`auction:${auction._id}`).emit('auction:update', auction);
}
