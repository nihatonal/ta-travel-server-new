import express from "express";
import { google } from "googleapis";
import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getDateRange } from "../utils/getDateRange.js";
const router = express.Router();

// 🔐 GA4 ayarları
//const KEY_FILE_PATH = "./service-account.json"; // JSON dosyan burada olmalı
const PROPERTY_ID = "511345803"; // kendi GA4 mülk ID’ni buraya yaz
const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);

const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
    },
});


// 🧩 1️⃣ Overview (Ziyaretçi, Görüntülenme, Oturum Süresi, Bounce Rate)
router.get("/overview", async (req, res) => {
    const period = req.query.period || "monthly";

    const currentRange = getDateRange(period);
    let previousRange;

    // önceki dönem karşılaştırması
    switch (period) {
        case "daily":
            previousRange = { startDate: "2daysAgo", endDate: "2daysAgo" };
            break;
        case "weekly":
            previousRange = { startDate: "14daysAgo", endDate: "8daysAgo" };
            break;
        case "monthly":
            previousRange = { startDate: "60daysAgo", endDate: "31daysAgo" };
            break;
        case "6months":
            previousRange = { startDate: "360daysAgo", endDate: "181daysAgo" };
            break;
        case "yearly":
            previousRange = { startDate: "730daysAgo", endDate: "366daysAgo" };
            break;
        default:
            previousRange = { startDate: "60daysAgo", endDate: "31daysAgo" };
    }

    try {
        const [currentData] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [currentRange],
            metrics: [
                { name: "totalUsers" },
                { name: "screenPageViews" },
                { name: "averageSessionDuration" },
                { name: "bounceRate" },
            ],
        });

        const [previousData] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [previousRange],
            metrics: [
                { name: "totalUsers" },
                { name: "screenPageViews" },
                { name: "averageSessionDuration" },
                { name: "bounceRate" },
            ],
        });

        const safeValue = (rows, i) =>
            rows && rows[0] && rows[0].metricValues[i]
                ? parseFloat(rows[0].metricValues[i].value)
                : 0;

        const totalVisitorsCurrent = safeValue(currentData.rows, 0);
        const totalVisitorsPrevious = safeValue(previousData.rows, 0);
        const pageViewsCurrent = safeValue(currentData.rows, 1);
        const pageViewsPrevious = safeValue(previousData.rows, 1);
        const avgSessionCurrent = safeValue(currentData.rows, 2);
        const avgSessionPrevious = safeValue(previousData.rows, 2);
        const bounceRateCurrent = safeValue(currentData.rows, 3);
        const bounceRatePrevious = safeValue(previousData.rows, 3);

        const calcChange = (cur, prev) => {
            if (!prev || prev === 0) return "0%";
            return (((cur - prev) / prev) * 100).toFixed(1) + "%";
        };

        const allZero =
            totalVisitorsCurrent === 0 &&
            pageViewsCurrent === 0 &&
            avgSessionCurrent === 0 &&
            bounceRateCurrent === 0;

        const warning = allZero ? "Данных нет за выбранный период" : null;

        res.json({
            totalVisitors: {
                value: totalVisitorsCurrent,
                change: calcChange(totalVisitorsCurrent, totalVisitorsPrevious),
            },
            pageViews: {
                value: pageViewsCurrent,
                change: calcChange(pageViewsCurrent, pageViewsPrevious),
            },
            avgSessionDuration: {
                value: avgSessionCurrent.toFixed(2),
                change: calcChange(avgSessionCurrent, avgSessionPrevious),
            },
            bounceRate: {
                value: bounceRateCurrent.toFixed(2),
                change: calcChange(bounceRateCurrent, bounceRatePrevious),
            },
            warning,
        });
    } catch (err) {
        console.error("Overview Error:", err);
        res.status(500).json({ error: "Failed to fetch overview data" });
    }
});




// 🧩 2️⃣ Device Distribution (Desktop, Mobile, Tablet)
router.get("/devices", async (req, res) => {
    const period = req.query.period || "monthly";
    const range = getDateRange(period);

    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
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
    const period = req.query.period || "monthly";
    const range = getDateRange(period);

    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
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

// 🧩 Tek endpoint: Traffic Overview (devices + sources)
router.get("/traffic-overview", async (req, res) => {
    const period = req.query.period || "monthly";
    const range = getDateRange(period);

    try {
        // ---- 1️⃣ Devices ----
        const [devicesResponse] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
            dimensions: [{ name: "deviceCategory" }],
            metrics: [{ name: "totalUsers" }],
        });

        const devices = {};
        if (devicesResponse.rows) {
            devicesResponse.rows.forEach((row) => {
                const key = row.dimensionValues[0].value.toLowerCase(); // desktop / mobile / tablet
                devices[key] = Number(row.metricValues[0].value);
            });
        }

        // ---- 2️⃣ Traffic Sources ----
        const [sourcesResponse] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
            dimensions: [{ name: "sessionSourceMedium" }],
            metrics: [{ name: "sessions" }],
            limit: 10,
        });

        const sources = sourcesResponse.rows
            ? sourcesResponse.rows.map((row) => ({
                source: row.dimensionValues[0].value,
                sessions: Number(row.metricValues[0].value),
            }))
            : [];

        // ---- 3️⃣ Combine Results ----
        res.json({
            devices, // { desktop: 120, mobile: 80, tablet: 30 }
            sources, // [{ source: "google / organic", sessions: 1200 }, ...]
            period,
            range,
        });
    } catch (err) {
        console.error("Traffic Overview Error:", err);
        res.status(500).json({ error: "Failed to fetch traffic overview data" });
    }
});

// 🧩 4️⃣ Top Pages
router.get("/top-pages", async (req, res) => {
    const period = req.query.period || "monthly";
    const range = getDateRange(period);

    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ desc: true, metric: { metricName: "screenPageViews" } }],
            limit: 10,
        });

        const pages = response.rows
            .map(row => ({
                path: row.dimensionValues[0].value,
                views: Number(row.metricValues[0].value),
            }))
            .filter(page => !page.path.startsWith("/admin"));

        res.json(pages.slice(0, 5));
    } catch (err) {
        console.error("Top Pages Error:", err);
        res.status(500).json({ error: "Failed to fetch top pages" });
    }
});


// 🧩 5️⃣ Session Duration by Day
router.get("/session-duration", async (req, res) => {
    const period = req.query.period || "weekly"; // varsayılan haftalık
    const range = getDateRange(period);

    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
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

// 🧩 8️⃣ Top Cities (Kullanıcıların Şehirlere Göre Dağılımı)
router.get("/cities", async (req, res) => {
    const period = req.query.period || "monthly";
    const range = getDateRange(period);

    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [range],
            dimensions: [{ name: "city" }],
            metrics: [{ name: "totalUsers" }],
            orderBys: [{ desc: true, metric: { metricName: "totalUsers" } }],
            limit: 10,
        });

        const cities = response.rows
            ?.filter(row => row.dimensionValues[0].value && row.dimensionValues[0].value !== "(not set)")
            .map(row => ({
                city: row.dimensionValues[0].value,
                users: Number(row.metricValues[0].value),
            })) || [];

        res.json(cities);
    } catch (err) {
        console.error("Cities Error:", err);
        res.status(500).json({ error: "Failed to fetch city data" });
    }
});

export default router;
