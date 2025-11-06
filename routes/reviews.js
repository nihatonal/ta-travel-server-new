import express from 'express';
import ReviewLink from '../models/ReviewLink.js';
import Review from '../models/Review.js';
import multer from 'multer';
import path from 'path';
const router = express.Router();

// Upload klasörü ve filename ayarı
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // server/uploads
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({ storage });

router.use(express.json());

router.get("/check-token", async (req, res) => {

    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ valid: false, message: "Token отсутствует." });
        }

        const link = await ReviewLink.findOne({ token });

        if (!link) {
            return res.status(404).json({ valid: false, message: "Ссылка не найдена." });
        }

        // Süresi dolmuş mu?
        if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
            return res.status(400).json({ valid: false, message: "Срок действия ссылки истек." });
        }

        // Eğer link sadece bir kere kullanılabiliyorsa:
        if (link.used) {
            return res.status(400).json({ valid: false, message: "Ссылка уже была использована." });
        }

        // Her şey yolundaysa:
        res.json({ valid: true });
    } catch (err) {
        console.error("Ошибка при проверке токена:", err);
        res.status(500).json({ valid: false, message: "Ошибка сервера." });
    }
});


// ✅ Müşteri yorum gönderimi
router.post("/submit-review", upload.single("image"), async (req, res) => {
    const { token, name, location, date, rating, comment, imageUrl } = req.body;
    try {
        // Token kontrolü
        const link = await ReviewLink.findOne({ token });
        if (!link) return res.status(400).json({ message: "Недействительная ссылка." });

        const review = new Review({
            token,
            name,
            location,
            date,
            rating,
            comment,
            imageUrl: imageUrl || null,
            approved: false,
        });

        await review.save();

        link.used = true;
        await link.save();

        res.status(201).json({
            message:
                "Отзыв отправлен.",
            review,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Сервер недоступен. Попробуйте позже." });
    }
});


// ✅ Onaylı yorumları frontend'de göstermek için (örnek)
router.get("/approved", async (req, res) => {
    try {
        const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Ana sayfa: son 3 onaylı
router.get('/', async (req, res) => {
    const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 }).limit(4);
    res.json(reviews);
});

// Testimonials: tüm onaylı
router.get('/all', async (req, res) => {
    const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 });
    res.json(reviews);
});



export default router;
