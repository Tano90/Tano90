/* GLB AI Suite – "Mein Markt" for the website integration. The v0.8 view asks for latitude and longitude and has
   its search button above the form. This adds, right in the location panel: search by address or place
   (OpenStreetMap Nominatim), "use my location" (browser geolocation), and the search button below the fields.
   The search itself stays the v0.8 scanMarket(); when its Overpass server fails, the public main server is tried. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Overpass: a second server when the first one is down or overloaded.
  const PRIMARY = 'https://overpass.private.coffee/api/interpreter';
  const FALLBACK = 'https://overpass-api.de/api/interpreter';
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url !== PRIMARY) return nativeFetch(input, init);
    try {
      const r = await nativeFetch(input, init);
      if (r.ok) return r;
      throw new Error('HTTP ' + r.status);
    } catch (_) {
      const { signal: _s, ...rest } = init || {};
      return nativeFetch(FALLBACK, { ...rest, signal: AbortSignal.timeout(40000) });
    }
  };

  function setLocation(label, lat, lon) {
    const l = $('#market-label'), a = $('#market-lat'), o = $('#market-lon');
    if (l && label) l.value = label.slice(0, 100);
    if (a) a.value = Number(lat).toFixed(5);
    if (o) o.value = Number(lon).toFixed(5);
  }

  function enhance() {
    const lat = $('#market-lat');
    if (!lat || $('#glbm-market')) return;
    const panel = lat.closest('.panel');
    const grid = lat.closest('.field-grid');
    if (!panel || !grid) return;

    const box = document.createElement('div');
    box.id = 'glbm-market';
    box.innerHTML = `
      <form class="glbm-market-search" role="search" aria-label="Standort suchen">
        <label for="glbm-market-q">Adresse oder Ort deines Betriebs</label>
        <div class="glbm-market-row">
          <input id="glbm-market-q" type="search" autocomplete="street-address" enterkeyhint="search" placeholder="z. B. Marktplatz 1, Düren">
          <button class="btn" type="submit">Suchen</button>
        </div>
      </form>
      <button class="btn glbm-market-geo" type="button">◎ Meinen Standort verwenden</button>
      <ul class="glbm-market-hits" aria-label="Gefundene Orte" hidden></ul>
      <p class="glbm-market-msg" aria-live="polite"></p>`;
    panel.insertBefore(box, grid);

    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn btn-primary glbm-market-go';
    go.textContent = 'Umkreis jetzt durchsuchen (20 km)';
    const status = $('#market-scan-status', panel);
    panel.insertBefore(go, status || null);

    const msg = $('.glbm-market-msg', box);
    const hits = $('.glbm-market-hits', box);
    const say = (t) => { msg.textContent = t; };

    $('form', box).addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = $('#glbm-market-q', box).value.trim();
      if (q.length < 3) return say('Bitte mindestens 3 Zeichen eingeben, z. B. Straße und Ort.');
      say('Suche Ort …'); hits.hidden = true; hits.innerHTML = '';
      try {
        const r = await nativeFetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&accept-language=de&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const list = (await r.json()).filter((x) => Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lon)));
        if (!list.length) return say('Nichts gefunden. Probiere Straße, Hausnummer und Ort.');
        if (list.length === 1) { setLocation(q, list[0].lat, list[0].lon); return say('Standort übernommen: ' + list[0].display_name); }
        hits.innerHTML = list.map((x, i) => `<li><button type="button" class="btn" data-i="${i}">${esc(x.display_name)}</button></li>`).join('');
        hits.hidden = false; say('Bitte den richtigen Ort wählen:');
        hits.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
          const x = list[Number(b.dataset.i)];
          setLocation(q, x.lat, x.lon); hits.hidden = true; say('Standort übernommen: ' + x.display_name);
        }));
      } catch (err) {
        say('Ortssuche gerade nicht erreichbar. Du kannst die Koordinaten auch direkt eintragen.');
      }
    });

    $('.glbm-market-geo', box).addEventListener('click', () => {
      if (!navigator.geolocation) return say('Dein Browser gibt keinen Standort frei.');
      say('Frage Standort ab …');
      navigator.geolocation.getCurrentPosition(
        (p) => { setLocation($('#market-label')?.value || 'Mein Standort', p.coords.latitude, p.coords.longitude); say('Standort übernommen (Genauigkeit etwa ' + Math.round(p.coords.accuracy) + ' m).'); },
        (e) => say(e.code === 1 ? 'Standort nicht freigegeben. Erlaube ihn in den Browser-Einstellungen oder suche nach der Adresse.' : 'Standort konnte nicht bestimmt werden. Suche nach der Adresse.'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });

    go.addEventListener('click', () => {
      const scan = document.querySelector('[data-action="scan-market"]');
      if (!scan) return;
      go.disabled = true; go.textContent = 'Suche läuft …';
      scan.click();
    });
  }

  // After a search the view is rendered again: jump to the results. On an error the button comes back.
  let scanning = false;
  document.addEventListener('click', (e) => { if (e.target.closest('[data-action="scan-market"]')) scanning = true; }, true);
  const main = $('#main');
  if (main) new MutationObserver(() => {
    enhance();
    if (!scanning) return;
    const status = $('#market-scan-status');
    if (status && /nicht verfügbar/.test(status.textContent || '')) {
      scanning = false;
      const go = $('.glbm-market-go'); if (go) { go.disabled = false; go.textContent = 'Erneut versuchen'; }
      return;
    }
    const results = [...document.querySelectorAll('#main .panel')].find((p) => /Letzte manuelle Suche/.test(p.textContent || ''));
    if (results) { scanning = false; results.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }).observe(main, { childList: true, subtree: true, characterData: true });
  enhance();
})();
