// The GLB AI Suite (public/suite, v0.8 as handed over) reads its Supabase project from window.GLB_CLOUD_CONFIG.
// Served from the environment instead of a file, so no project URL or key sits in the repository. Without
// both variables the suite runs as a demo whose data stays in the visitor's browser.
export const dynamic = "force-dynamic";

export function GET() {
  const url = process.env.GLB_SUPABASE_URL;
  const key = process.env.GLB_SUPABASE_PUBLISHABLE_KEY;
  const body = url && key
    ? `window.GLB_CLOUD_CONFIG = ${JSON.stringify({ url, publishableKey: key })};\n`
    : "window.GLB_CLOUD_ENABLED = false;\nwindow.GLB_CLOUD_CONFIG = {};\n";
  return new Response(body, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
}
