// utils/getDateRange.js
export function getDateRange(period) {
    switch (period) {
        case "daily":
            return { startDate: "1daysAgo", endDate: "today" };
        case "weekly":
            return { startDate: "7daysAgo", endDate: "today" };
        case "monthly":
            return { startDate: "30daysAgo", endDate: "today" };
        case "6months":
            return { startDate: "180daysAgo", endDate: "today" };
        case "yearly":
            return { startDate: "365daysAgo", endDate: "today" };
        default:
            return { startDate: "30daysAgo", endDate: "today" };
    }
}
