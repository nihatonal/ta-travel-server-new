import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  token: { type: String, required: true }, // Hangi link ile ilişkilendirildi
  name: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: String, required: true }, // MMM/YYYY
  imageUrl: { type: String },
  rating: { type: Number },
  comment: { type: String, required: true },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Review', reviewSchema);
