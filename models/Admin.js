// server/models/Admin.js
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // kullanıcı adı
    email: { type: String, required: true, unique: true },    // opsiyonel ama tavsiye edilir
    passwordHash: { type: String, required: true },
    role: { type: String, default: "admin" },
    resetCode: { type: String },
    resetCodeExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.models?.Admin || mongoose.model("Admin", adminSchema);
