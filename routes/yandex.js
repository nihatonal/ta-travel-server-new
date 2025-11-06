import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const upload = multer({ dest: "uploads/" });

const YANDEX_TOKEN = process.env.YANDEX_OAUTH_TOKEN;

router.post("/upload", upload.single("image"), async (req, res) => {
    if (!YANDEX_TOKEN) return res.status(500).json({ message: "Yandex token eksik." });
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Dosya yüklenmedi." });

    const fileName = file.originalname;
    const filePath = file.path;

    try {
        // 1️⃣ Upload link al
        const linkRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(fileName)}&overwrite=true`,
            { headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        const linkData = await linkRes.json();
        if (!linkData.href) {
            return res.status(500).json({ message: "Upload link alınamadı", details: linkData });
        }

        // 2️⃣ Dosyayı Yandex’e yükle
        const uploadRes = await fetch(linkData.href, {
            method: "PUT",
            body: fs.createReadStream(filePath),
        });
        if (!uploadRes.ok) throw new Error("Dosya yükleme başarısız");

        // 3️⃣ Dosyayı public hale getir
        const publishRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(fileName)}`,
            { method: "PUT", headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );

        if (!publishRes.ok) throw new Error("Dosya public yapılamadı");

        // 4️⃣ Public metadata al
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

        // 5️⃣ Geçici dosyayı sil
        fs.unlink(filePath, () => { });

        // ✅ Frontend'e dön
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
