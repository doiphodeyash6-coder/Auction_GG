import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['buyer', 'bidder', 'seller', 'admin'], default: 'buyer' },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
