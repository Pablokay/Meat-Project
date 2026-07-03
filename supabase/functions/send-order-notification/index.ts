const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const raw = await req.json();
    const KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "orders@koyanfresh.com";
    const ADMIN = Deno.env.get("ADMIN_ALERT_EMAIL");

    async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
      if (!KEY || !to) return false;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to, subject, text }),
      });
      return res.ok;
    }

    // Blast: email a list of recipients.
    if (raw?.blast) {
      let sent = 0;
      for (const to of (raw.emails ?? [])) {
        if (await sendEmail(to, "Koyan Fresh - Announcement", raw.message ?? "")) sent++;
      }
      return json({ success: true, sent });
    }

    // Order notification (customer + admin).
    const p = raw ?? {};
    const amount = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(p.totalAmount ?? 0);
    const fulfil = p.fulfillmentType === "delivery" ? "Home Delivery" : "Self Pickup";

    const customerBody = `Dear ${p.customerName ?? "customer"},\n\nThank you for your order at Koyan Fresh!\n\nOrder: ${p.orderNumber}\nItem(s): ${p.livestockName}\nTotal: ${amount}\nFulfillment: ${fulfil}\n\nTrack your order anytime with your order number.\n\nKoyan Fresh Team`;
    const emailSent = p.customerEmail ? await sendEmail(p.customerEmail, `Order ${p.orderNumber} | Koyan Fresh`, customerBody) : false;

    if (p.notifyAdmin && ADMIN) {
      const adminBody = `New order received.\n\nOrder: ${p.orderNumber}\nCustomer: ${p.customerName}\nContact: ${p.customerWhatsapp}\nItem(s): ${p.livestockName}\nTotal: ${amount}\nFulfillment: ${fulfil}`;
      await sendEmail(ADMIN, `New order ${p.orderNumber} - ${amount}`, adminBody);
    }

    return json({ success: true, emailSent });
  } catch (err) {
    return json({ success: false, error: String(err) }, 500);
  }
});
