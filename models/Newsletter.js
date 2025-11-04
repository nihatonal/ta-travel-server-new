import mongoose from "mongoose";

const NewsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email обязателен"], // Rusça: email gerekli
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Неверный формат email"], // küçük hata: "email" yerine "emal"
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // opsiyonel
    // name: { type: String, trim: true }
  },
  { collection: "newsleter" } // hata: newsletter yerine newsleter
);

// hot reload için Next.js
export default mongoose.models.Newsleter || mongoose.model("Newsleter", NewsletterSchema); // yine hata: Newsleter
