// Verifies a Paystack transaction using the PAYSTACK_SECRET_KEY secret and,
// if valid, marks the order paid using the Supabase service role.
// Deploy: supabase functions deploy verify-paystack --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Apikey, X-Client-Info",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { reference, orderId } = await req.json();
    const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!SECRET) return json({ success: false, error: "PAYSTACK_SECRET_KEY not set" }, 400);
    if (!reference) return json({ success: false, error: "reference required" }, 400);

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data?.data?.status === "success";

    if (ok && orderId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("orders").update({ payment_status: "confirmed", order_status: "confirmed", payment_method: "paystack", payment_reference: reference, updated_at: new Date().toISOString() }).eq("id", orderId);
      await supabase.from("order_updates").insert({ order_id: orderId, status: "confirmed", message: "Payment received via Paystack.", created_by: "system" });
    }

    return json({ success: ok, amount: data?.data?.amount ?? 0, status: data?.data?.status });
  } catch (err) {
    return json({ success: false, error: String(err) }, 500);
  }
});
