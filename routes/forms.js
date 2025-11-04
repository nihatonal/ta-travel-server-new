import express from "express";
import { sendMail } from "../utils/sendMail.js";


const router = express.Router();
// ✅ Yeni email ekle ve mail gönder
router.post("/order", async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

    const { name, phone, message, contactMethod, agree } = req.body;

    if (!name || !message || !contactMethod || !phone)
        return res.status(400).json({ message: "Все поля обязательны" });

    try {
        // Admin maili için HTML template
        const adminHtml = `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="background-color: #23c5e0; padding: 20px; text-align: center; color: #fff; font-size: 20px;">
                    Новый заказ с сайта TA-Travel
                </div>
                <div style="padding: 20px; color: #333; font-size: 16px; line-height: 1.5;">
                    <p><strong>Имя:</strong> ${name}</p>
                    <p><strong>Телефон:</strong> ${phone}</p>
                    <p><strong>Предпочтительный способ связи:</strong> ${contactMethod}</p>
                    <p><strong>Сообщение:</strong> ${message}</p>
                    <p><strong>Согласие на обработку данных:</strong> ${agree ? "Да ✅" : "Нет ❌"}</p>
                    <p style="margin-top: 15px; font-size: 14px; color: #555;">Дата заявки: ${new Date().toLocaleString("ru-RU")}</p>
                </div>
                <div style="background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 12px; color: #777;">
                    TA Travel — все права защищены
                </div>
            </div>
        </div>
        `;

        await sendMail({
            to: process.env.ADMIN_EMAIL,
            subject: "🆕 Новый заказ с сайта TA-Travel",
            html: adminHtml,
        });

        return res.status(201).json({ message: "Заявка успешно отправлена и email администратору отправлен." });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Ошибка сервера" });
    }
});



export default router;