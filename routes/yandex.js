import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
const router = express.Router();

const YANDEX_TOKEN = process.env.YANDEX_OAUTH_TOKEN;
const storage = multer.memoryStorage(); // disk yerine memory
const upload = multer({ storage });
router.get('/images/:fileName', async (req, res) => {
    const { fileName } = req.params;

    try {
        // reviews klasöründeki tam yolu oluştur
        const remotePath = `reviews/${fileName}`;

        // 1️⃣ Yandex'ten download linki al
        const apiUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(remotePath)}`;
        const linkRes = await fetch(apiUrl, {
            headers: { Authorization: `OAuth ${YANDEX_TOKEN}` },
        });

        const linkData = await linkRes.json();
        if (!linkData.href) {
            console.error('Yandex download link alınamadı:', linkData);
            return res.status(404).json({ message: 'Yandex download link alınamadı', details: linkData });
        }

        // 2️⃣ Yandex'ten dosyayı fetch et
        const fileRes = await fetch(linkData.href);
        if (!fileRes.ok) {
            return res.status(500).json({ message: 'Yandex dosya getirilemedi' });
        }

        // 3️⃣ İçerik türünü al ve aynı şekilde döndür
        const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        // 4️⃣ Stream olarak kullanıcıya aktar
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

    try {
        const { name, location, date } = req.body;
        const sanitized = `${name}_${location}_${date}`
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .toLowerCase();
        const fileExt = file.originalname.substring(file.originalname.lastIndexOf("."));
        const fileName = `${sanitized}${fileExt}`;

        // remotePath: reviews klasörünün içine koyuyoruz
        const remotePath = `reviews/${fileName}`;

        // (Opsiyonel) 0️⃣ reviews klasörünü oluştur (var ise 409 döner, görmezden gelebiliriz)
        const createDirRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent("reviews")}`,
            { method: "PUT", headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        // 201 -> created, 409 -> already exists, diğerleri hata olabilir; burada zorunlu kılmıyoruz
        if (!createDirRes.ok && createDirRes.status !== 409) {
            const errDetails = await createDirRes.text();
            console.warn("reviews klasörü oluşturulurken dikkat:", createDirRes.status, errDetails);
            // isteğe bağlı: hata fırlatmak yerine devam ettirebilirsiniz
        }

        // 1️⃣ Upload link al (remotePath kullan)
        const linkRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(remotePath)}&overwrite=true`,
            { headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        const linkData = await linkRes.json();
        if (!linkData.href) return res.status(500).json({ message: "Upload link alınamadı", details: linkData });

        // 2️⃣ Dosyayı Yandex’e yükle (buffer kullanıyoruz)
        const uploadRes = await fetch(linkData.href, {
            method: "PUT",
            body: file.buffer,
        });
        if (!uploadRes.ok) throw new Error("Dosya yükleme başarısız");

        // 3️⃣ Dosyayı public hale getir (aynı remotePath)
        const publishRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(remotePath)}`,
            { method: "PUT", headers: { Authorization: `OAuth ${YANDEX_TOKEN}` } }
        );
        if (!publishRes.ok) throw new Error("Dosya public yapılamadı");

        // 4️⃣ Public metadata al
        const metaRes = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(remotePath)}`,
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

        res.json({
            message: "Dosya başarıyla yüklendi!",
            fileName,
            remotePath,
            publicUrl,
            directUrl
        });

    } catch (err) {
        console.error("Yandex upload hatası:", err);
        res.status(500).json({ message: "Yandex Disk upload sırasında hata oluştu", error: err.message });
    }
});



export default router;
