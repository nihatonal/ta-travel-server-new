import express from "express";
import Newsletter from "../models/Newsletter.js";
import { verifyAdmin } from "../middleware/auth.js";
import { sendMail } from "../utils/sendMail.js";

const router = express.Router();

// ✅ Yeni email ekle ve mail gönder
router.post("/", async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email обязателен" });

    try {
        const existing = await Newsletter.findOne({ email });
        if (existing) return res.status(400).json({ message: "Email уже подписан" });

        const newSubscriber = await Newsletter.create({ email });

        // Kullanıcı maili
        await sendMail({
            to: email,
            subject: "Добро пожаловать в TA Travel!",
            html: `
          <div style="font-family: Arial, sans-serif; background-color: #f6f8fa; padding: 30px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <div style="background-color: #004AAD; padding: 20px; text-align: center;">
                <img src="https://www.ta-travel.ru/logo.png" alt="TA Travel" style="width: 140px; height: auto;" />
              </div>
              <div style="padding: 30px;">
                <h2 style="color: #004AAD; margin-bottom: 10px;">Спасибо, что с нами!</h2>
                <p style="font-size: 16px; color: #333;">
                  Вы успешно подписались на новости <strong>TA-<span style="#F7DEA1">Travel</span></strong>.
                </p>
              </div>
            </div>
          </div>
        `,
        });

        // Admin maili
        await sendMail({
            to: process.env.ADMIN_EMAIL, // admin mail
            subject: "🆕 Новый подписчик на рассылку TA Travel",
            html: `
          <p>Новый подписчик: <strong>${email}</strong></p>
          <p>Дата: ${new Date().toLocaleString("ru-RU")}</p>
        `,
        });

        return res.status(201).json({ message: "Подписка успешна, email отправлен.", subscriber: newSubscriber });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Ошибка сервера" });
    }
});

// ✅ Admin: tüm aboneleri listele
router.get("/admin", verifyAdmin, async (req, res) => {
    try {
        const subscribers = await Newsletter.find().sort({ createdAt: -1 });
        res.json({ success: true, subscribers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
});

// ✅ Admin: abonelik sil
router.delete("/admin/:id", verifyAdmin, async (req, res) => {
    try {
        const subscriber = await Newsletter.findByIdAndDelete(req.params.id);
        if (!subscriber) return res.status(404).json({ success: false, message: "Подписчик не найден" });

        res.json({ success: true, message: "Подписчик удалён" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
});

export default router;
