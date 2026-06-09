import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  livestockName: string;
  quantity: number;
  unit: string;
  totalAmount: number;
  fulfillmentType: string;
  deliveryDate: string;
  deliverySlotLabel: string;
  paymentMethod: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();

    const {
      orderNumber, customerName, customerEmail, customerWhatsapp,
      livestockName, quantity, unit, totalAmount,
      fulfillmentType, deliveryDate, deliverySlotLabel, paymentMethod
    } = payload;

    const fmtAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(totalAmount);
    const qtyLabel = `${quantity} ${unit === 'kg' ? 'KG' : 'Portion(s)'}`;
    const fulfillLabel = fulfillmentType === 'delivery' ? 'Home Delivery' : 'Self Pickup';
    const payLabel = paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Virtual Account';
    const dateLabel = deliveryDate ? `${deliveryDate}${deliverySlotLabel ? ' (' + deliverySlotLabel + ')' : ''}` : 'To be confirmed';

    const whatsappMsg = encodeURIComponent(
      `Hello ${customerName}! 🎉\n\nYour order has been received!\n\n` +
      `*Order Number:* ${orderNumber}\n` +
      `*Item:* ${livestockName}\n` +
      `*Quantity:* ${qtyLabel}\n` +
      `*Total:* ${fmtAmount}\n` +
      `*Fulfillment:* ${fulfillLabel}\n` +
      `*Scheduled:* ${dateLabel}\n` +
      `*Payment:* ${payLabel}\n\n` +
      `Please complete your payment to confirm the order. Our team will contact you shortly.\n\n` +
      `Thank you for choosing FreshLivestock! 🐄`
    );

    const emailBody = `
Dear ${customerName},

Thank you for your order at FreshLivestock!

ORDER CONFIRMATION
==================
Order Number: ${orderNumber}
Item: ${livestockName}
Quantity: ${qtyLabel}
Total Amount: ${fmtAmount}
Fulfillment: ${fulfillLabel}
Scheduled Date: ${dateLabel}
Payment Method: ${payLabel}

NEXT STEPS:
1. Complete your payment using the method selected.
2. Send your payment proof to our WhatsApp for faster confirmation.
3. Track your order anytime using your order number.

For any queries, reply to this email or WhatsApp us.

Thank you,
FreshLivestock Team
    `.trim();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "orders@freshlivestock.com";

    let emailSent = false;

    if (RESEND_API_KEY) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: customerEmail,
          subject: `Order Confirmed - ${orderNumber} | FreshLivestock`,
          text: emailBody,
        }),
      });
      emailSent = emailRes.ok;
    }

    return new Response(
      JSON.stringify({
        success: true,
        whatsappLink: `https://wa.me/${customerWhatsapp.replace(/\D/g, '')}?text=${whatsappMsg}`,
        emailSent,
        message: "Notification data prepared successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
