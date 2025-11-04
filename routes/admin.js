import express from 'express';
import ReviewLink from '../models/ReviewLink.js';
import Review from '../models/Review.js';
import Admin from '../models/Admin.js';

import { verifyAdmin } from '../middleware/auth.js';
import crypto from 'crypto';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendMail } from '../utils/sendMail.js';

const router = express.Router();


// 🔹 Admin Login
router.post("/login", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const admin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Администратор не найден" });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Неверный пароль" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.ADMIN_JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true, // <-- BURASI ÖNEMLİ
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Ошибка сервера" });
  }
});

// Request reset code
router.post("/request-reset", async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email обязателен" });

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: "Админ не найден" });

    // 6 haneli kod üret
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    admin.resetCode = code;
    admin.resetCodeExpires = Date.now() + 10 * 60 * 1000; // 10 dk geçerli
    await admin.save();

    // Mail gönderimi
    await sendMail({
      to: email,
      subject: "Сброс пароля для админа",
      text: `Ваш код для сброса пароля: ${code}. Он действителен 10 минут.`,
      html: `<p>Ваш код для сброса пароля: <strong>${code}</strong></p><p>Он действителен 10 минут.</p>`,
    });

    res.json({ success: true, message: "Код отправлен на email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// 🔹 Reset password
router.post("/reset-password", async (req, res) => {
  const { code, newPassword } = req.body;
  if (!code || !newPassword)
    return res.status(400).json({ message: "Все поля обязательны" });

  try {
    const admin = await Admin.findOne({
      resetCode: code,
      resetCodeExpires: { $gt: Date.now() },
    });

    if (!admin)
      return res.status(400).json({ message: "Неверный код или срок действия истёк" });

    const hash = await bcrypt.hash(newPassword, 10);
    admin.passwordHash = hash;
    admin.resetCode = null;
    admin.resetCodeExpires = null;
    await admin.save();

    res.json({ success: true, message: "Пароль успешно изменён" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// 🔹 Admin Change Password (no token required)
router.post("/change-password", async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email, старый и новый пароль обязательны",
    });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Администратор не найден" });
    }

    // Eski parolayı doğrula
    const valid = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: "Неверный старый пароль" });
    }

    // Yeni parolayı hashle
    const newHash = await bcrypt.hash(newPassword, 10);
    admin.passwordHash = newHash;
    await admin.save();

    return res.json({
      success: true,
      message: "Пароль успешно обновлён",
    });
  } catch (err) {
    console.error("Change password error:", err);
    res
      .status(500)
      .json({ success: false, message: "Ошибка сервера при изменении пароля" });
  }
});


// Yeni link oluştur
router.post('/review-links', verifyAdmin, async (req, res) => {
  const { guestName, expiresAt } = req.body;
  const token = crypto.randomBytes(16).toString('hex');

  try {
    const link = await ReviewLink.create({ token, guestName, expiresAt });
    res.json(link);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - tüm review linklerini listele
router.get('/review-links', verifyAdmin, async (req, res) => {
  try {
    const links = await ReviewLink.find().sort({ createdAt: -1 }); // en yeniler üstte
    res.json({ links }); // frontend'de data.links olarak kullanabilirsin
  } catch (err) {
    console.error('GET /admin/review-links error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/// ✅ Tüm yorumları getir (admin paneli için)
router.get("/reviews", verifyAdmin, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Yorum onaylama
// Onaylama
router.patch("/reviews/:id/approve", verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Yorum bulunamadı." });

    review.approved = true;
    await review.save();
    res.json({ message: "Yorum onaylandı.", review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Onayı kaldırma
router.patch("/reviews/:id/unapprove", verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Yorum bulunamadı." });

    review.approved = false;
    await review.save();
    res.json({ message: "Yorum yayından kaldırıldı.", review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ✅ Yorum silme
router.delete("/reviews/:id", verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: "Yorum bulunamadı." });

    res.json({ message: "Yorum silindi." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Link silme
router.delete("/reviews-link/:id", verifyAdmin, async (req, res) => {
  try {
    const link = await ReviewLink.findByIdAndDelete(req.params.id);
    if (!link) {
      return res.status(404).json({ success: false, message: "Ссылка не найдена." });
    }

    res.json({ success: true, message: "Ссылка удалена." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Ошибка сервера." });
  }
});






export default router;
