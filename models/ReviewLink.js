import mongoose from 'mongoose';

const reviewLinkSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  guestName: { type: String },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('ReviewLink', reviewLinkSchema);
