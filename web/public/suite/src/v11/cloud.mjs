/** Cloud access for the v1.1 tables (SQL 006). Uses the suite's signed-in Supabase client (src/cloud.js);
 *  no keys or organisation ids are typed into the browser. Every write goes through an RPC that checks role and
 *  organisation on the server (RC1: direct table inserts from the browser). */
const ctx = () => window.GLBCloudContext;
export const cloudOpen = () => Boolean(window.GLB_CLOUD_ENABLED && ctx()?.org);
export const POS_WINDOW_DAYS = 90;
export const POS_MAX_ROWS = 50000;

function fail(error, what) {
  const code = String(error?.message || error || "");
  const map = {
    ACCESS_DENIED: "Keine Berechtigung für diesen Betrieb.",
    ROLE_NOT_PERMITTED: "Deine Rolle darf das nicht.",
    TRAINING_ALREADY_TODAY: "Diese Mission hast du heute schon abgeschlossen.",
    UNKNOWN_OUTLET: "Ein Outlet der Datei ist im Betrieb nicht angelegt.",
    INVALID_LINES: "Die Positionen sind ungültig.",
  };
  const known = Object.keys(map).find((k) => code.includes(k));
  return new Error(`${what}: ${known ? map[known] : code || "unbekannter Fehler"}`);
}

/** Loads the POS lines of the last 90 days (as in RC1) and states whether more exist. */
export async function loadPos() {
  const { db, org } = ctx();
  const since = new Date(Date.now() - POS_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const rows = [];
  for (let from = 0; from < POS_MAX_ROWS; from += 1000) {
    const { data, error } = await db
      .from("glb_pos_lines")
      .select("*")
      .eq("organization_id", org)
      .gte("service_date", since)
      .order("service_date", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) throw fail(error, "Kassenbons laden");
    rows.push(...data);
    if (data.length < 1000) return { rows, since, truncated: false };
  }
  return { rows, since, truncated: true };
}
/** Server-side aggregation for periods beyond the loaded window: counts only, no single lines in the browser. */
export async function posSummary(from, to, outlet) {
  const { db, org } = ctx();
  const { data, error } = await db.rpc("glb_pos_summary", {
    p_org: org,
    p_from: from,
    p_to: to,
    p_outlet: outlet === "all" ? null : outlet,
  });
  if (error) throw fail(error, "Auswertung");
  return data;
}
export async function insertPos(lines, decision) {
  const { db, org } = ctx();
  const clean = lines.map(({ id, ...x }) => x);
  let inserted = 0,
    duplicates = 0,
    review = 0;
  for (let i = 0; i < clean.length; i += 500) {
    const { data, error } = await db.rpc("glb_pos_insert", { p_org: org, p_lines: clean.slice(i, i + 500), p_overlap: decision });
    if (error) throw fail(error, "Kassenbons speichern");
    inserted += data.inserted;
    duplicates += data.duplicates;
    review += data.review;
  }
  return { inserted, duplicates, review };
}
export async function decideReview(ids, decision) {
  const { db, org } = ctx();
  const { data, error } = await db.rpc("glb_pos_review", { p_org: org, p_ids: ids, p_decision: decision });
  if (error) throw fail(error, "Prüfentscheidung");
  return data;
}
export async function loadTraining() {
  const { db, org, userId } = ctx();
  const { data, error } = await db
    .from("glb_training_results")
    .select("*")
    .eq("organization_id", org)
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw fail(error, "Trainingsergebnisse laden");
  return data;
}
/** The answer is scored on the server against the stored key; the browser cannot send points. */
export async function submitTraining(stage, answer) {
  const { db, org } = ctx();
  const { data, error } = await db.rpc("glb_submit_training", { p_org: org, p_stage: stage, p_answer: Number(answer) });
  if (error) throw fail(error, "Training");
  return data;
}
export async function readWorkspaceStructure() {
  const { db, org } = ctx();
  const { data, error } = await db.rpc("glb_read_workspace", { p_org: org });
  if (error) throw fail(error, "Arbeitsbereich lesen");
  return data;
}
/** Server routes on this website (Next.js), protected by the Supabase session. */
export async function protectedApi(path, body) {
  const token = await ctx().accessToken();
  if (!token) throw new Error("Bitte erneut anmelden.");
  let r;
  try {
    r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, org: ctx().org }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    throw new Error(
      e?.name === "TimeoutError" ? "Der Server hat nicht innerhalb von 60 Sekunden geantwortet." : "Keine Verbindung zum Server.",
    );
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || data.error || `Serverfehler ${r.status}`);
  return data;
}
