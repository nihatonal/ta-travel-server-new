
export async function sendMail({ to, subject, html }) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "accept": "application/json",
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            sender: { name: "TA Travel", email: "info@ta-travel.ru" },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    const data = await res.json();
    console.log("📧 Brevo API response:", data);
    return data;
}
