/* Camperteil: Filme, Kopfzeile, Einblendungen und die 3D-Werkbank.
   Ergänzt app.js (Navigation, Formular); ändert den Anfrage-Ablauf nicht. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
const tallQuery = matchMedia('(max-aspect-ratio: 4/5)');
const root = document.documentElement;
root.classList.add('xp');

/* ---------- Filme ----------
   Standbild zuerst. Der Film wird erst geladen, wenn sein Abschnitt in die Nähe kommt,
   und nur automatisch abgespielt, wenn Bewegung erwünscht ist und keine Datensparoption aktiv ist. */
const conn = navigator.connection || {};
const sparsam = () => !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
const autoplayAllowed = () => !reducedQuery.matches && !sparsam();
// WebM/VP9 ist kleiner und läuft auch in Browsern ohne H.264; MP4 bleibt für ältere Safari-Versionen
const EXT = document.createElement('video').canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4';
const SIZE = { webm: { 'hero-wide': '0,5', 'hero-tall': '0,2', 'journey-wide': '1,5', 'journey-tall': '0,6' }, mp4: { 'hero-wide': '0,8', 'hero-tall': '0,3', 'journey-wide': '1,8', 'journey-tall': '0,7' } }[EXT];

const films = $$('.film-video').map((video) => {
  const frame = video.closest('.film-frame');
  const section = video.closest('section');
  const button = $(`[data-video="${video.id}"]`);
  const film = { video, frame, section, button, userPaused: false, failed: false, inView: false };
  const variant = () => `${tallQuery.matches ? video.dataset.tall : video.dataset.wide}.${EXT}`;
  const label = (text) => { if (button) $('.ft-label', button).textContent = text; };
  film.render = () => {
    if (!button) return;
    if (film.failed) { label('Film nicht verfügbar, Standbild bleibt'); button.disabled = true; button.dataset.state = 'error'; return; }
    const playing = !video.paused && !video.ended;
    button.dataset.state = playing ? 'playing' : 'paused';
    if (playing) label('Film anhalten');
    else if (!video.currentSrc && sparsam()) { const k = variant().split('/').pop().split('.')[0]; label(`Film abspielen (${SIZE[k] || '?'} MB)`); }
    else label('Film abspielen');
  };
  film.load = () => {
    if (video.getAttribute('src') || film.failed) return;
    video.src = variant();
    video.load();
  };
  film.play = () => {
    film.load();
    const p = video.play();
    if (p && p.catch) p.catch(() => { film.render(); }); // Autoplay gesperrt: Standbild bleibt, Knopf startet den Film
  };
  video.addEventListener('playing', () => { frame.classList.add('is-playing'); film.render(); });
  video.addEventListener('play', film.render);
  video.addEventListener('pause', film.render);
  video.addEventListener('error', () => { film.failed = true; frame.classList.remove('is-playing'); frame.classList.add('has-error'); film.render(); });
  if (button) button.addEventListener('click', () => {
    if (video.paused) { film.userPaused = false; film.play(); }
    else { film.userPaused = true; video.pause(); }
  });
  film.render();
  return film;
});

const filmIO = new IntersectionObserver((entries) => entries.forEach((e) => {
  const film = films.find((f) => f.section === e.target);
  film.inView = e.isIntersecting;
  if (e.isIntersecting) {
    // Erst nach dem Laden der Seite, damit Standbild und Schriften Vorrang haben
    const start = () => { if (film.inView && autoplayAllowed() && !film.userPaused) film.play(); };
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  } else if (!film.video.paused) film.video.pause();
}), { threshold: 0.15 });
films.forEach((f) => filmIO.observe(f.section));
reducedQuery.addEventListener?.('change', () => { if (reducedQuery.matches) films.forEach((f) => f.video.pause()); });
// Zwischen Hoch- und Querformat nur wechseln, solange der Film noch nicht läuft
tallQuery.addEventListener?.('change', () => films.forEach((f) => { if (f.video.paused && f.video.getAttribute('src')) { f.video.removeAttribute('src'); f.frame.classList.remove('is-playing'); f.video.load(); f.render(); } }));

/* ---------- Kopfzeile ----------
   Über dem Film transparent. Danach als ruhige Leiste: beim Weiterlesen ausgeblendet, beim Zurückscrollen sofort da. */
const header = $('.site-header');
const cta = $('[data-mobile-cta]');
const hero = $('.film-hero');
let lastY = scrollY, ticking = false;
const updateHeader = () => {
  ticking = false;
  const y = scrollY, past = y > hero.offsetHeight - header.offsetHeight - 48;
  const menuOpen = $('#nav-list')?.classList.contains('open');
  header.classList.toggle('is-solid', past);
  const hide = past && y > lastY + 4 && y > hero.offsetHeight + 120 && !menuOpen && !header.contains(document.activeElement);
  if (hide) header.classList.add('is-tucked');
  else if (y < lastY - 4 || !past) header.classList.remove('is-tucked');
  // Die mobile Schaltfläche weicht beim Lesen nach unten aus und kommt beim Zurückscrollen wieder
  if (cta) { if (y > lastY + 4) cta.classList.add('is-away'); else if (y < lastY - 4) cta.classList.remove('is-away'); }
  lastY = y;
};
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); } }, { passive: true });
header.addEventListener('focusin', () => header.classList.remove('is-tucked'));
updateHeader();

/* ---------- Mobile Schaltfläche ----------
   app.js blendet sie außerhalb von Hero und Formular ein. Hier zusätzlich: nicht über der 3D-Bühne und nicht über der Fußzeile. */
if (cta) {
  const blockers = new Set();
  const ctaIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? blockers.add(e.target) : blockers.delete(e.target)));
    cta.classList.toggle('is-suppressed', blockers.size > 0);
  }, { threshold: 0.25 });
  [$('#model-stage'), $('.site-footer')].forEach((n) => n && ctaIO.observe(n));
}

/* ---------- Einblendungen ----------
   Nur Abschnittsköpfe, kurz und einmalig. Ohne Bewegungswunsch bleibt alles sofort sichtbar. */
if (!reducedQuery.matches && 'IntersectionObserver' in window) {
  root.classList.add('motion-enabled');
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.manifesto, .lab-copy, .section-head, .journey-copy').forEach((n) => {
    // Was beim Laden schon im Bild ist, wird nicht versteckt
    if (n.getBoundingClientRect().top < innerHeight * 0.9) return;
    n.classList.add('reveal'); io.observe(n);
  });
}

/* ---------- Stückliste: Antippen und Tastatur ---------- */
const board = $('[data-board]');
if (board) {
  $$('tr[data-pos]', board).forEach((row) => {
    const activate = () => {
      const pos = row.dataset.pos;
      board.classList.add('has-focus');
      $$('[data-pos]', board).forEach((n) => { n.classList.toggle('is-active', n.dataset.pos === pos); n.classList.toggle('selected', n === row); });
    };
    row.addEventListener('click', activate);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

/* ---------- 3D-Werkbank ---------- */
const stage = $('#model-stage');
// Three.js und das Modell erst laden, wenn die Werkbank in die Nähe kommt: hält den Seitenstart schlank
if (stage) {
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { near.disconnect(); setupWorkbench(); }
  }, { rootMargin: '600px 0px' });
  near.observe(stage);
}

async function setupWorkbench() {
  const canvas = $('#part-canvas');
  const status = $('#stage-status');
  const slider = $('#explode');
  const out = $('#explode-value');
  const autoBtn = $('#auto-rotate');
  const wireBtn = $('#wireframe');
  const labels = Object.fromEntries($$('[data-label]', stage).map((n) => [n.dataset.label, n]));
  const say = (text) => { status.textContent = ''; setTimeout(() => { status.textContent = text; }, 30); };
  const onLabels = (pos, alpha) => {
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const [k, n] of Object.entries(labels)) {
      if (!pos[k]) continue;
      const [x, y] = pos[k];
      // Nur zeigen, was sicher innerhalb der Bühne und oberhalb der Bedienleiste liegt
      const inside = x > 8 && x < w - 130 && y > 48 && y < h - 96;
      n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      n.style.opacity = inside ? alpha.toFixed(2) : '0';
    }
  };
  const ctx = { stage, canvas, coarse, reduced: reducedQuery.matches, onLabels, onLost: () => fallBack('Grafik wurde vom Gerät zurückgesetzt'), onTooSlow: () => fallBack('WebGL zu langsam') };
  let viewer = null;

  async function useSoftware(reason) {
    const { createSoftwareViewer } = await import('./software3d.js');
    viewer = createSoftwareViewer({ ...ctx, canvas: $('#part-canvas') });
    stage.dataset.ready = 'software3d';
    stage.dataset.reason = reason;
  }
  function staticFallback(reason) {
    $('#part-canvas').hidden = true;
    $('#model-fallback').hidden = false;
    stage.dataset.ready = 'fallback'; stage.dataset.reason = reason;
    $$('.model-panel button, .model-panel input, .stage-tools button').forEach((b) => { b.disabled = true; });
  }
  async function fallBack(reason) {
    try { await useSoftware(reason); applyState(); } catch (e) { staticFallback(reason + '; ' + e.message); }
  }

  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) throw new Error('kein WebGL2');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const { createWebGLViewer } = await import('./part3d.js');
    viewer = createWebGLViewer(ctx);
    stage.dataset.ready = 'webgl';
  } catch (e) {
    try { await useSoftware(e.message); } catch (e2) { staticFallback(e.message + '; ' + e2.message); return; }
  }

  // Bedienelemente: einmal verdrahtet, für beide Darstellungen.
  // Erst den Knopfzustand zeichnen lassen, dann das 3D-Bild ändern: die Rückmeldung kommt sofort, auch wenn ein Bild länger dauert.
  const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
  const ui = { material: 'sand', explode: 0, auto: false, wire: false };
  function applyState() {
    viewer.setMaterial(ui.material); viewer.setExplode(ui.explode / 100); viewer.setAuto(ui.auto); viewer.setWire(ui.wire);
  }
  const syncButtons = () => {
    autoBtn.setAttribute('aria-pressed', String(ui.auto));
    autoBtn.textContent = ui.auto ? 'Drehung anhalten' : 'Langsam drehen';
    wireBtn.setAttribute('aria-pressed', String(ui.wire));
    slider.value = ui.explode; out.textContent = `${ui.explode} %`;
    slider.style.setProperty('--fill', `${ui.explode}%`);
    slider.setAttribute('aria-valuetext', `${ui.explode} Prozent auseinandergezogen`);
    stage.dataset.exploded = String(ui.explode);
    stage.dataset.surface = ui.material;
  };
  $$('.material[data-material]').forEach((b) => b.addEventListener('click', () => {
    ui.material = b.dataset.material;
    $$('.material[data-material]').forEach((n) => { const on = n === b; n.classList.toggle('active', on); n.setAttribute('aria-pressed', String(on)); });
    syncButtons(); say(`Oberfläche ${b.textContent.trim()}`); afterPaint(() => viewer.setMaterial(ui.material));
  }));
  slider.addEventListener('input', () => { ui.explode = Number(slider.value); viewer.setExplode(ui.explode / 100); syncButtons(); });
  autoBtn.addEventListener('click', () => { ui.auto = !ui.auto; syncButtons(); afterPaint(() => viewer.setAuto(ui.auto)); });
  wireBtn.addEventListener('click', () => { ui.wire = !ui.wire; syncButtons(); say(ui.wire ? 'Drahtgitter an' : 'Drahtgitter aus'); afterPaint(() => viewer.setWire(ui.wire)); });
  $('#zoom-in').addEventListener('click', () => afterPaint(() => viewer.zoomBy(0.82)));
  $('#zoom-out').addEventListener('click', () => afterPaint(() => viewer.zoomBy(1.22)));
  $('#reset-model').addEventListener('click', () => {
    ui.explode = 0; ui.auto = false; ui.wire = false; syncButtons(); say('Ansicht zurückgesetzt'); afterPaint(() => viewer.reset());
  });
  // Tastatur, wenn die Bühne ausgewählt ist: Pfeile drehen, + / − zoomen, Pos1 setzt zurück
  stage.addEventListener('keydown', (e) => {
    if (e.target.tagName !== 'CANVAS') return;
    const map = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.14], ArrowDown: [0, 0.14] };
    if (map[e.key]) { e.preventDefault(); viewer.rotateBy(...map[e.key]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); viewer.zoomBy(0.82); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); viewer.zoomBy(1.22); }
    else if (e.key === 'Home') { e.preventDefault(); $('#reset-model').click(); }
  });
  syncButtons();
  // Für automatisierte Prüfungen lesbar, ohne Einfluss auf die Seite
  stage.debug3d = () => ({ ready: stage.dataset.ready, ...viewer.debug() });
}
