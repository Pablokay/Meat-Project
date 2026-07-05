// Termii messaging (SMS / WhatsApp) — key is read from the TERMII_API_KEY secret,
// never from the client. Deploy with: supabase functions deploy send-termii --no-verify-jwt
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Apikey, X-Client-Info",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Normalise NG numbers to Termii's expected format (234XXXXXXXXXX, no +).
function norm(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "234" + d.slice(1);
  if (d.startsWith("234")) return d;
  if (d.length === 10) return "234" + d;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { channel = "sms", to = [], message = "" } = await req.json();
    const KEY = Deno.env.get("TERMII_API_KEY");
    const FROM = Deno.env.get("TERMII_SENDER") ?? "Termii";
    const BASE = Deno.env.get("TERMII_BASE_URL") ?? "https://v4.api.termii.com";
    if (!KEY) return json({ success: false, error: "TERMII_API_KEY not set" }, 400);

    const recipients: string[] = (Array.isArray(to) ? to : [to]).map(norm).filter((x: string) => x.length >= 11);
    if (recipients.length === 0) return json({ success: false, error: "No valid recipients" }, 400);

    // Termii bulk SMS. WhatsApp uses channel "whatsapp" (requires approved sender/template).
    const res = await fetch(`${BASE}/api/sms/send/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        to: recipients,
        from: FROM,
        sms: message,
        type: "plain",
        channel: channel === "whatsapp" ? "whatsapp" : "generic",
      }),
    });
    const data = await res.json().catch(() => ({}));
    return json({ success: res.ok, sent: recipients.length, termii: data }, res.ok ? 200 : 502);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500);
  }
});
