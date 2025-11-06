import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
const router = express.Router();
const upload = multer({ dest: "uploads/" });

const YANDEX_TOKEN = process.env.YANDEX_OAUTH_TOKEN;

router.get('/images/:fileName', async (req, res) => {
    const { fileName } = req.params;

    try {
        const apiUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(fileName)}`;
        const linkRes = await fetch(apiUrl, {
            headers: { Authorization: `OAuth ${YANDEX_TOKEN}` },
        });

        const linkData = await linkRes.json();
        if (!linkData.href) return res.status(404).json({ message: 'Yandex download link alınamadı' });

        // Yandex'ten dosyayı fetch et
        const fileRes = await fetch(linkData.href);
        const contentType = fileRes.headers.get('content-type');

        res.setHeader('Content-Type', contentType);
        fileRes.body.pipe(res);
    } catch (err) {
        console.error('Yandex proxy hatası:', err);
        res.status(500).json({ message: 'Dosya alınamadı', error: err.message });
    }
});
router.post("/upload", upload.single("image"), async (req, res) => {
    if (!YANDEX_TOKEN) return res.status(500).json({ message: "Yandex token eksik." });

    const file = req.file;
    if (!file) return res.status(400).json({ message: "Dosya yüklenmedi." });

    const filePath = file.path;

    try {
        // 1️⃣ Yeni dosya adını oluştur
        const { name, location, date } = req.body;
        const sanitized = `${name}_${location}_${date}`
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .toLowerCase();
        const fileName = `${sanitized}${path.extname(file.originalname)}`;

        // 2️⃣ Upload link al
        const linkRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(fileName)}&overwrite=true`,
            { headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        const linkData = await linkRes.json();
        if (!linkData.href) return res.status(500).json({ message: "Upload link alınamadı", details: linkData });

        // 3️⃣ Dosyayı Yandex’e yükle
        const uploadRes = await fetch(linkData.href, {
            method: "PUT",
            body: fs.createReadStream(filePath),
        });
        if (!uploadRes.ok) throw new Error("Dosya yükleme başarısız");

        // 4️⃣ Dosyayı public hale getir
        const publishRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(fileName)}`,
            { method: "PUT", headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        if (!publishRes.ok) throw new Error("Dosya public yapılamadı");

        // 5️⃣ Public metadata al
        const metaRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(fileName)}`,
            { headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        const metaData = await metaRes.json();
        const publicUrl = metaData.public_url || null;

        let directUrl = null;
        if (publicUrl) {
            const directRes = await fetch(
                `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}`
            );
            const directData = await directRes.json();
            directUrl = directData.href || null;
        }

        // 6️⃣ Geçici dosyayı sil
        fs.unlink(filePath, () => { });

        // ✅ Frontend’e dön
        res.json({
            message: "Dosya başarıyla yüklendi!",
            fileName,
            publicUrl,
            directUrl
        });

    } catch (err) {
        console.error("Yandex upload hatası:", err);
        res.status(500).json({ message: "Yandex Disk upload sırasında hata oluştu", error: err.message });
    }
});


export default router;
