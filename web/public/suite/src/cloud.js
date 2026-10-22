/* GLB Cloud Pilot 0.8 - Supabase Auth + organization scoped, optimistic cloud snapshots.
   Public credentials only. This is an early pilot, NOT production-certified software. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const area = $("#cloud-layer");
  const status = $("#cloud-sync-status");
  const cfg = window.GLB_CLOUD_CONFIG || {};
  let db,
    session = null,
    orgs = [],
    currentOrg = null,
    currentRole = null;
  let revision = 0,
    dirty = 0,
    saved = 0,
    saving = false,
    blocked = false;
  let timer = null,
    ready = false,
    displaying = false,
    authMode = "signin";
  let fatalMessage = "";
  let problemLabel = ""; // why saving stopped: kept in the status until it is resolved
  const showStatus = (text, type = "") => {
    status.textContent = text;
    status.className = "cloud-status" + (type ? " " + type : "");
  };
  const lock = () => {
    document.body.classList.add("glb-locked");
    ready = false;
  };
  const unlock = () => {
    document.body.classList.remove("glb-locked");
    ready = true;
  };
  const errorText = (e) => String(e?.message || e || "Unbekannter Fehler").replace(/^Error:\s*/, "");
  const card = (content) => {
    area.innerHTML = `<section class="cloud-cover"><div class="cloud-login-card"><header class="cloud-brand"><span class="cloud-brand-icon">G</span><div><strong>GLB <em>AI Suite</em></strong><small>GASTRO LEADERSHIP BOARD · CLOUD</small></div></header>${content}</div></section>`;
  };
  // Sidebar footer: says where the data of this session is kept.
  const side = (title, detail) => {
    const t = $(".side-status strong"),
      d = $(".side-status small");
    if (t) t.textContent = title;
    if (d) d.textContent = detail;
  };

  // Website integration: without a configured Supabase project the suite runs as a demo in this browser only.
  // No sign-in exists then; the account button explains that instead of doing nothing.
  if (window.GLB_CLOUD_ENABLED === false) {
    document.body.classList.remove("glb-locked");
    const time = () => new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    showStatus("Demo · Daten nur in diesem Browser", "pending");
    // Called by app.js after each local save: only a save that went through is reported as saved.
    window.GLBStorageStatus = (ok, message = "") =>
      ok ? showStatus("Demo · im Browser gespeichert " + time(), "pending") : showStatus("Demo · NICHT gespeichert: " + message, "danger");
    window.GLB08UI?.activate?.("owner");
    side("Demo-Arbeitsbereich", "Speichert nur in diesem Browser, keine Cloud");
    $("#cloud-account")?.addEventListener("click", () => {
      card(`<div class="cloud-title"><span class="cloud-eyebrow">DEMO OHNE KONTO</span><h1>Hier gibt es keine Anmeldung</h1>
        <p>Diese Suite läuft ohne verbundenes Cloud-Projekt. Deshalb kannst du dich nicht anmelden, und es gibt keine Synchronisierung.</p></div>
        <ul class="cloud-demo-facts"><li>Deine Eingaben liegen nur in diesem Browser auf diesem Gerät. Niemand sonst sieht sie.</li>
        <li>Sie gehen verloren, wenn du die Website-Daten des Browsers löschst. Sichere sie mit einem Backup.</li>
        <li>Für den echten Betrieb verbindet der Betreiber ein Supabase-Projekt. Dann erscheint hier die Anmeldung mit Betrieb, Rollen und Cloud-Speicherung.</li></ul>
        <div class="cloud-account-actions"><button class="cloud-primary" type="button" data-demo="close">Zurück zur Suite</button><button type="button" data-demo="close" data-action="export-json">JSON-Backup herunterladen</button></div>`);
      area.querySelector("[data-demo]")?.focus();
    });
    area.addEventListener("click", (e) => {
      if (e.target.closest('[data-demo="close"]')) area.innerHTML = "";
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && area.querySelector("[data-demo]")) area.innerHTML = "";
    });
    return;
  }

  const fmtStatus = () => {
    if (blocked) showStatus(problemLabel || "Synchronisation blockiert", "danger");
    else if (saving) showStatus("Speichern …", "pending");
    else if (dirty > saved) showStatus(navigator.onLine ? "Änderungen werden gespeichert …" : "Offline · Änderungen warten", "pending");
    else showStatus("In der Cloud gespeichert", "good");
  };
  const setCloudProblem = (msg, conflict = false) => {
    blocked = true;
    problemLabel = conflict ? "Bearbeitungskonflikt" : "Nicht gespeichert";
    showStatus(problemLabel, "danger");
    let box = $("#cloud-warning");
    if (!box) {
      box = document.createElement("div");
      box.id = "cloud-warning";
      document.body.appendChild(box);
    }
    box.className = "cloud-warning";
    box.innerHTML = `<strong>${conflict ? "Ein anderer Benutzer hat Daten gespeichert." : "Die Cloud-Speicherung ist fehlgeschlagen."}</strong><span>${esc(msg)}</span><div><button data-cloud="export" type="button">Ungesicherte Änderungen herunterladen</button><button data-cloud="reload" type="button">Cloudstand neu laden</button>${conflict ? "" : '<button data-cloud="retry" type="button">Erneut speichern</button>'}</div>`;
  };
  const clearCloudProblem = () => {
    $("#cloud-warning")?.remove();
    blocked = false;
    problemLabel = "";
    fmtStatus();
  };
  function authView(message = "") {
    lock();
    displaying = true;
    const signup = authMode === "signup";
    card(`<div class="cloud-title"><span class="cloud-eyebrow">GESCHÜTZTER ARBEITSBEREICH</span><h1>${signup ? "GLB Account erstellen" : "Willkommen zurück"}</h1><p>Deine Produkte, Reports, Rezepturen und Lagerdaten stehen nach dem Login online bereit.</p></div>
     ${message ? `<p class="cloud-alert">${esc(message)}</p>` : ""}
     <form id="cloud-auth-form" class="cloud-form"><label>E-Mail<input required type="email" name="email" autocomplete="email" placeholder="name@betrieb.de"></label><label>Passwort<input required type="password" name="password" minlength="8" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="Mindestens 8 Zeichen"></label><button type="submit" class="cloud-primary">${signup ? "Account registrieren" : "Einloggen"} →</button></form>
     <div class="cloud-linkrow"><button data-cloud="switch-auth" type="button">${signup ? "Schon registriert? Einloggen" : "Noch kein Account? Registrieren"}</button>${signup ? "" : '<button type="button" data-cloud="reset-password">Passwort vergessen?</button>'}</div>
     <p class="cloud-fine">Zugang nur für autorisierte Benutzer. Bitte keine echten Daten importieren, bevor der Betrieb und seine Benutzerrechte eingerichtet und geprüft wurden.</p>`);
  }
  async function handleAuth(form) {
    const email = String(new FormData(form).get("email") || "").trim();
    const password = String(new FormData(form).get("password") || "");
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    button.textContent = "Bitte prüfen …";
    try {
      if (authMode === "signup") {
        const { data, error } = await db.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          authMode = "signin";
          authView("Registrierung angelegt. Bitte E-Mail bestätigen und danach einloggen.");
          return;
        }
        session = data.session;
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data.session;
      }
      await loadWorkspaces();
    } catch (e) {
      authView("Anmeldung fehlgeschlagen: " + errorText(e));
    }
  }
  async function loadWorkspaces() {
    lock();
    if (!session) {
      authView();
      return;
    }
    try {
      const { error: acceptError } = await db.rpc("glb_accept_invitations");
      if (acceptError) throw acceptError;
      const { data: memberships, error: mErr } = await db
        .from("glb_memberships")
        .select("organization_id,role")
        .eq("user_id", session.user.id);
      if (mErr) throw mErr;
      const ids = (memberships || []).map((m) => m.organization_id);
      let data = [];
      if (ids.length) {
        const r = await db.from("glb_organizations").select("id,name,created_at").in("id", ids);
        if (r.error) throw r.error;
        data = r.data || [];
      }
      orgs = (memberships || [])
        .map((m) => ({ ...m, organization: data.find((o) => o.id === m.organization_id) }))
        .filter((x) => x.organization);
      workspaceView();
    } catch (e) {
      card(
        `<h1>Einrichtung überprüfen</h1><p class="cloud-alert">${esc(errorText(e))}</p><p>Ist die SQL-Migration in Supabase ausgeführt? Existiert der Benutzer bereits mit bestätigter E-Mail?</p><button class="cloud-primary" data-cloud="refresh-workspaces">Erneut versuchen</button><button class="cloud-quiet" data-cloud="logout">Ausloggen</button>`,
      );
    }
  }
  function workspaceView(message = "") {
    lock();
    card(`<div class="cloud-title"><span class="cloud-eyebrow">DEINE ARBEITSBEREICHE</span><h1>Betrieb auswählen</h1><p>${esc(session?.user?.email || "")} · Jeder Betrieb speichert seine eigenen Daten getrennt.</p></div>
     ${message ? `<p class="cloud-alert">${esc(message)}</p>` : ""}
     <div class="cloud-workspace-list">${orgs.length ? orgs.map((x) => `<button type="button" data-cloud="open" data-org="${x.organization_id}"><span class="cloud-org-icon">${esc(x.organization.name.slice(0, 2).toUpperCase())}</span><span><strong>${esc(x.organization.name)}</strong><small>${window.GLBAccess?.label(x.role) || x.role}</small></span><b>→</b></button>`).join("") : '<p class="cloud-muted">Noch kein Betrieb vorhanden. Lege unten deinen ersten Arbeitsbereich an.</p>'}</div>
     <form id="cloud-create-form" class="cloud-form cloud-create"><label>Neuen Gastronomiebetrieb anlegen<input name="name" required maxlength="100" placeholder="z. B. Mein Restaurant"></label><button type="submit" class="cloud-primary">Betrieb erstellen</button></form>
     <div class="cloud-linkrow"><button type="button" data-cloud="logout">Ausloggen</button><button type="button" data-cloud="refresh-workspaces">Einladungen aktualisieren</button></div>`);
  }
  async function openWorkspace(id) {
    const chosen = orgs.find((o) => o.organization_id === id);
    if (!chosen) return workspaceView("Der Betrieb ist nicht verfügbar.");
    lock();
    card(
      '<div class="cloud-title"><h1>Arbeitsbereich wird geladen</h1><p>Datenbankverbindung und Zugriffsrechte werden geprüft.</p></div>',
    );
    try {
      const { data, error } = await db.rpc("glb_read_workspace", { p_org: id });
      if (error) throw error;
      currentOrg = chosen;
      currentRole = data.role || chosen.role;
      window.GLBAccess?.setRole(currentRole);
      revision = Number(data.revision) || 0;
      dirty = 0;
      saved = 0;
      blocked = false;
      $("#cloud-warning")?.remove();
      if (data.data && Array.isArray(data.data.items)) window.GLBAppSync.hydrate(data.data);
      else {
        window.GLBAppSync.startBlank(chosen.organization.name);
      }
      $("#workspace-name").textContent = window.GLBAppSync.snapshot().business;
      const btn = $("#cloud-account");
      if (btn) btn.textContent = chosen.organization.name + " · Konto";
      area.innerHTML = "";
      unlock();
      fmtStatus();
      window.GLB08UI?.activate(currentRole);
      side("GLB Cloud", `${chosen.organization.name} · ${window.GLBAccess?.label(currentRole) || currentRole}`);
      document.body.classList.toggle("glb-viewer", currentRole === "viewer");
      if (!data.data || !Array.isArray(data.data.items)) changed(window.GLBAppSync.snapshot());
      // v1.1 modules load their own tables (POS lines, training) for exactly this organization and role
      window.dispatchEvent(new CustomEvent("glb:cloud-open", { detail: { org: id, role: currentRole } }));
    } catch (e) {
      currentOrg = null;
      workspaceView("Betrieb konnte nicht geladen werden: " + errorText(e));
    }
  }
  function changed() {
    if (!ready || !currentOrg || currentRole === "viewer") return;
    dirty++;
    fmtStatus();
    clearTimeout(timer);
    timer = setTimeout(() => {
      void flush();
    }, 1000);
  }
  async function flush() {
    if (saving || blocked || !ready || !currentOrg || currentRole === "viewer" || dirty <= saved) return;
    if (!navigator.onLine) return fmtStatus(); // stays pending; the "online" event sends it
    saving = true;
    fmtStatus();
    try {
      while (dirty > saved && !blocked && ready) {
        const toSave = dirty;
        const data = window.GLBAppSync.snapshot();
        const json = JSON.stringify(data);
        if (new Blob([json]).size > 3900000)
          throw Error("Datenumfang zu groß. Bitte Fotos auslagern. Maximal etwa 3,9 MB pro Arbeitsbereich.");
        const full = window.GLBAccess?.isPrivileged() ?? false;
        const { data: newRev, error } = await db.rpc(full ? "glb_save_snapshot" : "glb_save_limited", {
          p_org: currentOrg.organization_id,
          p_expected_revision: revision,
          p_data: data,
        });
        if (error) throw error;
        revision = Number(newRev);
        saved = toSave;
      }
    } catch (e) {
      setCloudProblem(errorText(e), errorText(e).includes("REVISION_CONFLICT"));
    } finally {
      saving = false;
      fmtStatus();
    }
  }
  async function createWorkspace(form) {
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Erstelle Betrieb …";
    try {
      const { data, error } = await db.rpc("glb_create_workspace", { p_name: name });
      if (error) throw error;
      await loadWorkspaces();
      if (data && orgs.some((o) => o.organization_id === data)) await openWorkspace(data);
    } catch (e) {
      workspaceView("Betrieb konnte nicht angelegt werden: " + errorText(e));
    }
  }
  function exportUnsaved() {
    const value = window.GLBAppSync.snapshot();
    const blob = new Blob([JSON.stringify({ ...value, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "GLB_Ungesicherte_Daten_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function reloadFromCloud() {
    if (
      dirty > saved &&
      !confirm('Ungesicherte Änderungen werden verworfen. Vorher über "Ungesicherte Änderungen herunterladen" sichern. Fortfahren?')
    )
      return;
    clearTimeout(timer);
    blocked = false;
    ready = false;
    await openWorkspace(currentOrg.organization_id);
  }
  async function accountView() {
    if (!currentOrg) return workspaceView();
    if (dirty > saved) await flush();
    if (dirty > saved) {
      alert("Änderungen sind noch nicht synchronisiert. Bitte den Speicherstatus prüfen oder ein Backup herunterladen.");
      return;
    }
    document.body.classList.add("glb-locked");
    let memberHtml = "";
    if (window.GLBAccess?.canManageUsers()) {
      const { data, error } = await db.rpc("glb_list_members", { p_org: currentOrg.organization_id });
      if (!error) {
        const options = Object.entries(window.GLBAccess.roles)
          .filter(([k]) =>
            ["service_staff", "kitchen_staff", "sales", "service_lead", "kitchen_lead", "restaurant_manager", "general_manager"].includes(
              k,
            ),
          )
          .filter(([k]) => currentRole === "owner" || k !== "general_manager")
          .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`)
          .join("");
        memberHtml = `<div class="cloud-members"><h3>Team & Rollen</h3>${(data || []).map((m) => `<div class="cloud-member-row"><span>${esc(m.email)}<small>${esc(window.GLBAccess.label(m.role))}</small></span>${m.role === "owner" ? "<b>Owner</b>" : `<div class="glb08-member-edit"><select aria-label="Rolle auswählen für ${esc(m.email)}" data-cloud-select-role="${esc(m.user_id)}">${options.replace(`value="${esc(m.role)}"`, `value="${esc(m.role)}" selected`)}</select><button type="button" data-cloud="save-role" data-user="${esc(m.user_id)}" data-current-role="${esc(m.role)}">Speichern</button></div>`}</div>`).join("")}</div>
       <form id="cloud-invite-form" class="cloud-form"><label>Mitarbeiter per E-Mail für den Betrieb freigeben<input type="email" required name="email" placeholder="mitarbeiter@restaurant.de"></label><label>Mitarbeiterrolle<select name="role">${options}</select></label><button class="cloud-primary" type="submit">Einladung hinterlegen</button><small>Zurzeit wird keine Einladungs-Mail versendet. Die Person muss sich mit exakt dieser E-Mail registrieren und danach anmelden.</small></form>`;
      }
    }
    card(`<div class="cloud-title"><span class="cloud-eyebrow">ACCOUNT MANAGEMENT</span><h1>${esc(currentOrg.organization.name)}</h1><p>Angemeldet als ${esc(session.user.email)} · Rolle: ${esc(window.GLBAccess?.label(currentRole) || currentRole)}</p></div>
     <div class="cloud-account-actions"><button data-cloud="resume" class="cloud-primary">Zurück zur Suite</button><button data-cloud="choose">Betrieb wechseln</button><button data-cloud="manual-save">Jetzt synchronisieren</button><button data-cloud="export">JSON-Backup herunterladen</button><button data-cloud="install-help">Mobile App installieren</button><button data-cloud="logout">Ausloggen</button></div>${memberHtml}`);
  }
  async function inviteMember(form) {
    const f = new FormData(form);
    const { error } = await db.rpc("glb_invite_member_v08", {
      p_org: currentOrg.organization_id,
      p_email: String(f.get("email")),
      p_role: String(f.get("role")),
    });
    if (error) alert("Einladung fehlgeschlagen: " + errorText(error));
    else {
      alert("Einladung hinterlegt. Mitarbeiter können sich jetzt mit dieser E-Mail anmelden und den Betrieb öffnen.");
      await accountView();
    }
  }
  async function editMemberRole(userId, oldRole) {
    if (!window.GLBAccess?.canManageUsers()) return;
    const role = String(document.querySelector(`[data-cloud-select-role="${userId}"]`)?.value || "");
    const valid = ["service_staff", "kitchen_staff", "sales", "service_lead", "kitchen_lead", "restaurant_manager", "general_manager"];
    if (!valid.includes(role) || (currentRole !== "owner" && role === "general_manager")) {
      alert("Diese Rolle ist nicht erlaubt.");
      return;
    }
    if (role === oldRole) return;
    if (!confirm("Mitarbeiterrolle wirklich auf " + window.GLBAccess.label(role) + " ändern?")) return;
    const { error } = await db.rpc("glb_set_member_role_v08", { p_org: currentOrg.organization_id, p_user: userId, p_role: role });
    if (error) alert("Rollenänderung fehlgeschlagen: " + errorText(error));
    else await accountView();
  }
  async function signOut() {
    if (ready && dirty > saved) {
      await flush();
      if (dirty > saved) {
        alert("Änderungen sind noch nicht gespeichert. Bitte Backup herunterladen und Problem beheben.");
        return;
      }
    }
    clearTimeout(timer);
    ready = false;
    currentOrg = null;
    session = null;
    currentRole = null;
    window.GLBAccess?.setRole(null);
    await db.auth.signOut();
    // nothing of the previous organisation stays in memory or on screen
    window.dispatchEvent(new CustomEvent("glb:cloud-close"));
    window.GLBAppSync?.startBlank?.("Nicht angemeldet");
    authView();
  }
  async function chooseDifferent() {
    if (dirty > saved) {
      await flush();
      if (dirty > saved) {
        alert("Bitte ungesicherte Änderungen zuerst sichern.");
        return;
      }
    }
    currentOrg = null;
    ready = false;
    window.GLBAccess?.setRole(null);
    window.dispatchEvent(new CustomEvent("glb:cloud-close"));
    window.GLBAppSync?.startBlank?.("Kein Betrieb gewählt");
    await loadWorkspaces();
  }
  async function resetPassword() {
    const email = prompt("E-Mail-Adresse für Passwort-Zurücksetzung:");
    if (!email) return;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    authView(
      error
        ? "Zurücksetzen fehlgeschlagen: " + errorText(error)
        : "Falls die Adresse bekannt ist, wurde eine E-Mail zur Zurücksetzung versendet.",
    );
  }
  function recoveryView(message = "") {
    lock();
    card(
      `<div class="cloud-title"><span class="cloud-eyebrow">ACCOUNT SECURITY</span><h1>Neues Passwort festlegen</h1><p>Gib für deinen GLB Account ein neues Passwort ein.</p></div>${message ? `<p class="cloud-alert">${esc(message)}</p>` : ""}<form id="cloud-recovery-form" class="cloud-form"><label>Neues Passwort<input type="password" name="newpassword" required minlength="8" autocomplete="new-password"></label><button class="cloud-primary" type="submit">Passwort speichern</button></form>`,
    );
  }
  async function finishRecovery(form) {
    const pw = String(new FormData(form).get("newpassword") || "");
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) {
      recoveryView(errorText(error));
      return;
    }
    const { data } = await db.auth.getSession();
    session = data.session;
    await loadWorkspaces();
  }
  async function init() {
    lock();
    if (!cfg.url || !cfg.publishableKey) {
      fatalMessage = "Bitte in config.js die Supabase-Projekt-URL und den Publishable Key eintragen.";
      card(
        `<h1>Cloud-Konfiguration fehlt</h1><p class="cloud-alert">${esc(fatalMessage)}</p><p>Öffne die Datei <code>config.js</code>. Die Anleitung steht in <code>START_CLOUD.md</code>.</p>`,
      );
      return;
    }
    if (!window.supabase?.createClient) {
      card(
        '<h1>Onlineverbindung erforderlich</h1><p class="cloud-alert">Die Supabase-Bibliothek konnte nicht geladen werden. Bitte die veröffentlichte HTTPS-Adresse und Internetverbindung verwenden.</p>',
      );
      return;
    }
    db = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    db.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") queueMicrotask(() => recoveryView());
    });
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      session = data.session;
      if (session) await loadWorkspaces();
      else authView();
    } catch (e) {
      authView(errorText(e));
    }
  }
  window.GLBCloudBridge = { changed };
  // Read-only context for extension modules (v1.1 tables are protected by RLS on the server).
  window.GLBCloudContext = {
    get db() {
      return db;
    },
    get org() {
      return ready && currentOrg ? currentOrg.organization_id : null;
    },
    get role() {
      return ready && currentOrg ? currentRole : null;
    },
    get userId() {
      return session?.user?.id || null;
    },
    async accessToken() {
      const { data } = await db.auth.getSession();
      return data.session?.access_token || null;
    },
  };
  document.addEventListener("submit", (e) => {
    if (e.target.id === "cloud-auth-form") {
      e.preventDefault();
      void handleAuth(e.target);
    } else if (e.target.id === "cloud-recovery-form") {
      e.preventDefault();
      void finishRecovery(e.target);
    } else if (e.target.id === "cloud-create-form") {
      e.preventDefault();
      void createWorkspace(e.target);
    } else if (e.target.id === "cloud-invite-form") {
      e.preventDefault();
      void inviteMember(e.target);
    }
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-cloud]");
    if (!a) return;
    e.preventDefault();
    switch (a.dataset.cloud) {
      case "switch-auth":
        authMode = authMode === "signin" ? "signup" : "signin";
        authView();
        break;
      case "open":
        void openWorkspace(a.dataset.org);
        break;
      case "resume":
        area.innerHTML = "";
        unlock();
        break;
      case "choose":
        void chooseDifferent();
        break;
      case "refresh-workspaces":
        void loadWorkspaces();
        break;
      case "logout":
        void signOut();
        break;
      case "manual-save":
        area.innerHTML = "";
        unlock();
        void flush();
        break;
      case "retry":
        blocked = false;
        $("#cloud-warning")?.remove();
        void flush();
        break;
      case "reload":
        void reloadFromCloud();
        break;
      case "export":
        exportUnsaved();
        break;
      case "reset-password":
        void resetPassword();
        break;
      case "install-help":
        alert(
          "Android: Chrome öffnen → Menü (⋮) → App installieren / Zum Startbildschirm hinzufügen.\n\niPhone: Safari öffnen → Teilen → Zum Home-Bildschirm.\n\nDie GLB Suite benötigt weiterhin Internet zum Login und Speichern.",
        );
        break;
      case "save-role":
        void editMemberRole(a.dataset.user, a.dataset.currentRole);
        break;
    }
  });
  $("#cloud-account")?.addEventListener("click", () => void accountView());
  window.addEventListener("offline", () => fmtStatus());
  window.addEventListener("online", () => {
    if (ready && !blocked) void flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && ready && !blocked) void flush();
  });
  window.addEventListener("beforeunload", (e) => {
    if (ready && dirty > saved) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  // Viewers have backend-enforced read-only rights; prevent basic editing UI actions too.
  document.addEventListener(
    "submit",
    (e) => {
      if (currentRole === "viewer" && ready && !e.target.id.startsWith("cloud-")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert("Nur-Lesen-Zugang: Bearbeitung nicht erlaubt.");
      }
    },
    true,
  );
  void init();
})();
