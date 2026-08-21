// Supabase Edge Function that invokes the OSmini automation scheduler.
// Deploy with:  supabase functions deploy automation-cron
// Set secrets:  supabase secrets set OSMINI_APP_URL=https://your-app.vercel.app OSMINI_CRON_SECRET=...
// Schedule from the SQL editor (pg_cron + pg_net):
//   select cron.schedule(
//     'osmini-automation-cycle',
//     '*/5 * * * *',
//     $$select net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/automation-cron',
//       headers := jsonb_build_object('Authorization', 'Bearer <ANON_KEY>'),
//       body := '{}'::jsonb
//     );$$
//   );
//
// Alternatively point any external scheduler directly at POST /api/cron
// with the CRON_SECRET bearer token.
Deno.serve(async () => {
  const appUrl = Deno.env.get("OSMINI_APP_URL") ?? "";
  const cronSecret = Deno.env.get("OSMINI_CRON_SECRET") ?? "";
  if (!appUrl || !cronSecret) {
    return new Response("Missing OSMINI_APP_URL or OSMINI_CRON_SECRET", { status: 500 });
  }
  const res = await fetch(`${appUrl}/api/cron`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = await res.text();
  return new Response(body, { status: res.status, headers: { "Content-Type": "application/json" } });
});
