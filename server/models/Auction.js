import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bidderName: { type: String, required: true, trim: true, maxlength: 32 },
  amount: { type: Number, required: true, min: 0 },
}, { timestamps: true });

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 90 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, required: true, trim: true, maxlength: 32 },
  imageUrl: { type: String, default: '/assets/ceramic-vase.svg', maxlength: 500 },
  startingPrice: { type: Number, required: true, min: 1 },
  currentPrice: { type: Number, required: true, min: 1 },
  minIncrement: { type: Number, default: 500, min: 1 },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  endsAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  highestBidderName: { type: String, default: '' },
  bids: { type: [bidSchema], default: [] },
}, { timestamps: true });

auctionSchema.index({ status:  1, endsAt: 1 });
auctionSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model('Auction', auctionSchema);
