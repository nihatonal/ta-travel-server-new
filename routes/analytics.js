import express from "express";
import { google } from "googleapis";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
const router = express.Router();

// 🔐 GA4 ayarları
//const KEY_FILE_PATH = "./service-account.json"; // JSON dosyan burada olmalı
const PROPERTY_ID = "511345803"; // kendi GA4 mülk ID’ni buraya yaz
const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];
const analyticsDataClient = new BetaAnalyticsDataClient({
    keyFilename: "/etc/secrets/GA_KEY.json",
});




// 🧩 1️⃣ Overview (Ziyaretçi, Görüntülenme, Oturum Süresi, Bounce Rate)
router.get("/overview", async (req, res) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            metrics: [
                { name: "totalUsers" },
                { name: "screenPageViews" },
                { name: "averageSessionDuration" },
                { name: "bounceRate" },
            ],
        });

        const rows = response.rows[0].metricValues;
        res.json({
            totalVisitors: Number(rows[0].value),
            pageViews: Number(rows[1].value),
            avgSessionDuration: parseFloat(rows[2].value).toFixed(2),
            bounceRate: parseFloat(rows[3].value).toFixed(2),
        });
    } catch (err) {
        console.error("Overview Error:", err);
        res.status(500).json({ error: "Failed to fetch overview data" });
    }
});


// 🧩 2️⃣ Device Distribution (Desktop, Mobile, Tablet)
router.get("/devices", async (req, res) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "deviceCategory" }],
            metrics: [{ name: "totalUsers" }],
        });

        const result = {};
        response.rows.forEach(row => {
            result[row.dimensionValues[0].value] = Number(row.metricValues[0].value);
        });

        res.json(result);
    } catch (err) {
        console.error("Devices Error:", err);
        res.status(500).json({ error: "Failed to fetch device data" });
    }
});


// 🧩 3️⃣ Traffic Sources
router.get("/sources", async (req, res) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "sessionSourceMedium" }],
            metrics: [{ name: "sessions" }],
            limit: 10,
        });

        const sources = response.rows.map(row => ({
            source: row.dimensionValues[0].value,
            sessions: Number(row.metricValues[0].value),
        }));

        res.json(sources);
    } catch (err) {
        console.error("Sources Error:", err);
        res.status(500).json({ error: "Failed to fetch traffic sources" });
    }
});


// 🧩 4️⃣ Top Pages
router.get("/top-pages", async (req, res) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ desc: true, metric: { metricName: "screenPageViews" } }],
            limit: 10, // filtre sonrası 5 gösterilecek
        });

        // Hassas sayfaları filtrele
        const pages = response.rows
            .map(row => ({
                path: row.dimensionValues[0].value,
                views: Number(row.metricValues[0].value),
            }))
            .filter(page => !page.path.startsWith("/admin")); // admin sayfalarını gizle

        // Sadece top 5’i döndür
        res.json(pages.slice(0, 5));
    } catch (err) {
        console.error("Top Pages Error:", err);
        res.status(500).json({ error: "Failed to fetch top pages" });
    }
});


// 🧩 5️⃣ Session Duration by Day
router.get("/session-duration", async (req, res) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
            dimensions: [{ name: "dayOfWeek" }],
            metrics: [{ name: "averageSessionDuration" }],
        });

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const data = response.rows.map(row => ({
            day: days[parseInt(row.dimensionValues[0].value)],
            seconds: parseFloat(row.metricValues[0].value),
        }));

        res.json(data);
    } catch (err) {
        console.error("Session Duration Error:", err);
        res.status(500).json({ error: "Failed to fetch session duration" });
    }
});



// 🧩 6️⃣ Conversions (Anonim Eventler)
router.get("/conversions", async (req, res) => {
    try {
        const allowedEvents = ["click", "page_view", "user_engagement"]; // mevcut eventler

        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "eventName" }],
            metrics: [{ name: "eventCount" }],
            dimensionFilter: {
                filter: {
                    fieldName: "eventName",
                    inListFilter: {
                        values: allowedEvents,
                        caseSensitive: false,
                    },
                },
            },
        });

        const events = response.rows?.map(row => ({
            event: row.dimensionValues[0].value,
            count: Number(row.metricValues[0].value),
        })) || [];

        const result = allowedEvents.map(ev => {
            const found = events.find(e => e.event === ev);
            return { event: ev, count: found ? found.count : 0 };
        });

        res.json(result);
    } catch (err) {
        console.error("Conversions Error:", err);
        res.status(500).json({ error: "Failed to fetch conversions" });
    }
});






// 🧩 7️⃣ Real-Time Data (Aktif Kullanıcılar)
router.get("/real-time", async (req, res) => {
    try {
        const realtime = google.analyticsdata("v1beta");
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const response = await realtime.properties.runRealtimeReport({
            property: `properties/${PROPERTY_ID}`,
            metrics: [{ name: "activeUsers" }],
            dimensions: [{ name: "unifiedScreenName" }],
        });

        res.json({
            activeUsers: response.data.totals?.[0]?.metricValues?.[0]?.value || 0,
            topActivePages:
                response.data.rows?.map(row => ({
                    path: row.dimensionValues[0].value,
                    users: Number(row.metricValues[0].value),
                })) || [],
        });
    } catch (err) {
        console.error("Realtime Error:", err);
        res.status(500).json({ error: "Failed to fetch realtime data" });
    }
});

export default router;
