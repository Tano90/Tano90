/* Camperteil: perspektivische 3D-Ansicht mit Canvas 2D für Geräte ohne WebGL.
   Gleiche Schnittstelle wie part3d.js. */
const COLORS = { sand: [203, 189, 159], olive: [104, 112, 90], graphite: [58, 63, 59] };
const REST = { yaw: -0.5, pitch: -0.3, zoom: 1 };
const VIEWS = { schraeg: REST, vorne: { yaw: 0, pitch: -0.08, zoom: 1 }, seite: { yaw: -1.45, pitch: -0.12, zoom: 1 } };

export function createSoftwareViewer({ stage, canvas, reduced, onLabels }) {
  // Ein Canvas, das schon einen WebGL-Kontext hatte, liefert keinen 2D-Kontext mehr: dann ersetzen
  let ctx = canvas.getContext('2d');
  if (!ctx) {
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh); canvas = fresh; ctx = canvas.getContext('2d');
  }
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar');

  const s = { yaw: REST.yaw - 0.6, pitch: REST.pitch, zoom: 0.92, explode: 0, explodeTarget: 0, wire: false, auto: false, color: COLORS.sand.slice(), colorTarget: COLORS.sand.slice() };
  let tween = null, w = 600, h = 600, visible = false, running = false, last = 0;

  /* Geometrie als Flächenliste */
  const rounded = (W, H, r, n = 8) => {
    const pts = [];
    for (const [cx, cy, a0] of [[W / 2 - r, H / 2 - r, 0], [-W / 2 + r, H / 2 - r, Math.PI / 2], [-W / 2 + r, -H / 2 + r, Math.PI], [W / 2 - r, -H / 2 + r, Math.PI * 1.5]])
      for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  };
  const face = (points, kind, shade = 1) => ({ points, kind, shade });
  const ring = (outer, inner, z, d, kind) => {
    const f = [], o = rounded(...outer), i = rounded(...inner);
    for (let j = 0; j < o.length; j++) {
      const k = (j + 1) % o.length;
      f.push(face([[...o[j], z], [...o[k], z], [...i[k], z], [...i[j], z]], kind));
      f.push(face([[...o[j], z], [...o[j], z - d], [...o[k], z - d], [...o[k], z]], kind, 0.85));
      f.push(face([[...i[j], z], [...i[k], z], [...i[k], z - d], [...i[j], z - d]], kind, 0.7));
      f.push(face([[...o[j], z - d], [...i[j], z - d], [...i[k], z - d], [...o[k], z - d]], kind, 0.65));
    }
    return f;
  };
  const plate = (W, H, r, z, d, kind) => {
    const ps = rounded(W, H, r), f = [face(ps.map((p) => [...p, z]), kind), face([...ps].reverse().map((p) => [...p, z - d]), kind, 0.7)];
    for (let j = 0; j < ps.length; j++) { const k = (j + 1) % ps.length; f.push(face([[...ps[j], z], [...ps[k], z], [...ps[k], z - d], [...ps[j], z - d]], kind, 0.8)); }
    return f;
  };
  const box = (x, y, z, sx, sy, sz, kind) => {
    const p = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, c]) => [x + a * sx / 2, y + b * sy / 2, z + c * sz / 2]);
    return [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]].map((ix) => face(ix.map((i) => p[i]), kind));
  };
  const cylinder = (x, y, z, r, d, kind) => {
    const f = [], n = 22, front = [], back = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2, b = ((j + 1) / n) * Math.PI * 2;
      const p = [x + Math.cos(a) * r, y + Math.sin(a) * r, z], q = [x + Math.cos(b) * r, y + Math.sin(b) * r, z];
      front.push(p); back.push([p[0], p[1], z - d]); f.push(face([p, q, [q[0], q[1], z - d], [p[0], p[1], z - d]], kind));
    }
    f.push(face(front, kind)); f.push(face(back.reverse(), kind, 0.75));
    return f;
  };

  const rotate = ([x, y, z]) => {
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const a = x * cy + z * sy, b = -x * sy + z * cy;
    return [a, y * cp - b * sp, y * sp + b * cp];
  };
  const project = (p) => {
    const [x, y, z] = rotate(p), scale = Math.min(w, h) * 0.14 * s.zoom, persp = 8 / (8 - z);
    return [w / 2 + x * scale * persp, h * 0.47 - y * scale * persp, z];
  };
  const lighting = (ps) => {
    const [a, b, c] = ps, u = b.map((v, i) => v - a[i]), v = c.map((v, i) => v - a[i]);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = rotate(n.map((x) => x / l));
    return 0.62 + Math.max(0, n[0] * -0.35 + n[1] * 0.7 + n[2] * 0.62) * 0.48;
  };

  let frames = 0;
  function draw() {
    frames++;
    ctx.clearRect(0, 0, w, h);
    // weicher Bodenschatten
    const sh = ctx.createRadialGradient(w * 0.5, h * 0.83, 1, w * 0.5, h * 0.83, Math.min(w, h) * 0.36);
    sh.addColorStop(0, 'rgba(5,20,14,.45)'); sh.addColorStop(1, 'rgba(5,20,14,0)');
    ctx.save(); ctx.translate(0, h * 0.83); ctx.scale(1, 0.18); ctx.translate(0, -h * 0.83);
    ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h * 2); ctx.restore();

    const e = s.explode, iz = 0.23 + e * 1.0, sz = (i) => 0.43 + e * (1.55 + i * 0.2);
    // Malerverfahren in Gruppen: Bauteile als Ganzes nach Tiefe ordnen, Rippen immer auf der sichtbaren Seite des Einlegers
    const groups = [];
    const group = (center, faceList) => groups.push({ depth: rotate(center)[2], faces: faceList });
    group([0, 0, 0], ring([3.7, 4.1, 0.32], [2.42, 2.8, 0.15], 0.14, 0.32, 'plastic'));
    const ribs = [];
    for (let i = 0; i < 7; i++) ribs.push(...box(0, -0.6 + i * 0.2, iz + 0.026, 1.8, 0.05, 0.05, 'plastic'));
    const plateFaces = plate(2.37, 2.75, 0.14, iz, 0.15, 'insert');
    const frontVisible = rotate([0, 0, 1])[2] > 0;
    const bySort = (list) => list.map((f) => ({ ...f, depth: f.points.reduce((a, p) => a + rotate(p)[2], 0) / f.points.length })).sort((a, b) => a.depth - b.depth);
    groups.push({ depth: rotate([0, 0, iz])[2], faces: frontVisible ? [...bySort(plateFaces), ...bySort(ribs)] : [...bySort(ribs), ...bySort(plateFaces)], sorted: true });
    [[-1.48, -1.66], [1.48, 1.66]].forEach(([x, y], i) => {
      const z = sz(i);
      // Der Schaft steckt im Ruhezustand im Rahmen und wird nur auseinandergezogen gezeichnet
      group([x, y, z], [...(e < 0.05 ? [] : cylinder(x, y, z - 0.04, 0.065, 0.6, 'metal')), ...cylinder(x, y, z, 0.15, 0.08, 'metal'), ...box(x, y, z + 0.003, 0.2, 0.025, 0.008, 'slot'), ...box(x, y, z + 0.003, 0.025, 0.2, 0.008, 'slot')]);
    });
    // Ohne Explosion liegen Einleger und Schrauben im Rahmen: feste Reihenfolge je nach Blickseite.
    // Auseinandergezogen entscheidet die Tiefe der Bauteile.
    if (e < 0.05) { if (!frontVisible) groups.reverse(); }
    else groups.sort((a, b) => a.depth - b.depth);
    const faces = groups.flatMap((g) => (g.sorted ? g.faces : bySort(g.faces)));
    for (const f of faces) {
      const pts = f.points.map(project);
      const base = f.kind === 'plastic' ? s.color : f.kind === 'insert' ? [77, 88, 70] : f.kind === 'metal' ? [184, 190, 180] : [42, 51, 44];
      const light = lighting(f.points) * f.shade;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      if (!s.wire) { ctx.fillStyle = `rgb(${base.map((v) => Math.min(255, Math.round(v * light))).join(',')})`; ctx.fill(); ctx.strokeStyle = 'rgba(30,45,29,.1)'; ctx.lineWidth = 0.4; }
      else { ctx.strokeStyle = 'rgba(212,223,189,.55)'; ctx.lineWidth = 0.8; }
      ctx.stroke();
    }
    const pr = (p) => project(p).slice(0, 2);
    onLabels({ frame: pr([1.85, 1.2, 0.1]), insert: pr([-1.2, -1.1, iz]), screws: pr([1.48, 1.66, sz(1) + 0.05]) }, Math.min(1, Math.max(0, (e - 0.25) / 0.35)));
  }

  /* Sanfte Übergänge, nur solange etwas passiert */
  const tick = (now) => {
    running = false;
    if (!visible || document.hidden) return;
    const dt = Math.min(250, now - (last || now)); last = now;
    let busy = false;
    if (tween) {
      const p = Math.min(1, (now - tween.start) / tween.ms), k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      for (const key of ['yaw', 'pitch', 'zoom']) s[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * k;
      if (p >= 1) tween = null; busy = true;
    }
    if (s.explodeTween) {
      const p = Math.min(1, (now - s.explodeTween.start) / s.explodeTween.ms), k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      s.explode = s.explodeTween.from + (s.explodeTween.to - s.explodeTween.from) * k;
      if (p >= 1) s.explodeTween = null; busy = true;
    }
    for (let i = 0; i < 3; i++) if (Math.abs(s.color[i] - s.colorTarget[i]) > 0.5) { s.color[i] += (s.colorTarget[i] - s.color[i]) * (reduced ? 1 : 1 - Math.exp(-10 * dt / 1000)); busy = true; } else s.color[i] = s.colorTarget[i];
    if (s.auto) { s.yaw += dt * 0.0005; busy = true; }
    draw();
    if (busy) request();
  };
  const request = () => { if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(tick); } };
  const go = (to, ms) => {
    if (reduced || !ms) { Object.assign(s, to); request(); return; }
    tween = { from: { yaw: s.yaw, pitch: s.pitch, zoom: s.zoom }, to: { yaw: to.yaw ?? s.yaw, pitch: to.pitch ?? s.pitch, zoom: to.zoom ?? s.zoom }, start: performance.now(), ms };
    request();
  };
  const clampPitch = (p) => Math.max(-1.3, Math.min(1.3, p));
  const clampZoom = (z) => Math.max(0.65, Math.min(1.5, z));

  const size = () => {
    w = stage.clientWidth; h = stage.clientHeight; if (!w || !h) return;
    const d = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); draw();
  };
  const ro = new ResizeObserver(size); ro.observe(stage); size();

  /* Zeiger: ein Finger/Maus dreht, zwei Finger zoomen; senkrechtes Wischen scrollt die Seite */
  canvas.style.touchAction = 'pan-y';
  const pointers = new Map(); let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture?.(e.pointerId); tween = null; });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) s.zoom = clampZoom(s.zoom * d / pinch); pinch = d;
    } else { s.yaw += (e.clientX - px) * 0.009; s.pitch = clampPitch(s.pitch + (e.clientY - py) * 0.006); }
    request();
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(t, (e) => { pointers.delete(e.pointerId); pinch = 0; });
  canvas.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); s.zoom = clampZoom(s.zoom - e.deltaY * 0.001); request(); }, { passive: false });

  // Einstieg: kurze Drehung in die Ausgangsansicht
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && stage.dataset.introDone !== 'true') { stage.dataset.introDone = 'true'; go({ ...REST }, reduced ? 0 : 1500); }
    request();
  }, { threshold: 0.2 });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => { last = 0; request(); });

  return {
    kind: 'software',
    get canvas() { return canvas; },
    setMaterial(name) { if (COLORS[name]) { s.colorTarget = COLORS[name].slice(); request(); } },
    setExplode(t) { s.explodeTarget = t; if (reduced) { s.explode = t; s.explodeTween = null; } else s.explodeTween = { from: s.explode, to: t, start: performance.now(), ms: Math.abs(t - s.explode) > 0.2 ? 600 : 160 }; request(); },
    setAuto(on) { s.auto = on && !reduced; request(); },
    setWire(on) { s.wire = on; request(); },
    zoomBy(f) { const t = tween ? tween.to : s; go({ zoom: clampZoom(t.zoom / f) }, 260); },
    rotateBy(dYaw, dPitch) { const t = tween ? tween.to : s; go({ yaw: t.yaw + dYaw, pitch: clampPitch(t.pitch + dPitch) }, 220); },
    setView(name) { if (VIEWS[name]) { s.auto = false; go({ ...VIEWS[name] }, 800); } },
    reset() { s.auto = false; s.wire = false; this.setExplode(0); go({ ...REST }, 900); },
    debug() { return { yaw: +s.yaw.toFixed(2), pitch: +s.pitch.toFixed(2), zoom: +s.zoom.toFixed(2), explode: +s.explode.toFixed(2), color: s.colorTarget.join(','), wire: s.wire, auto: s.auto, frames }; }
  };
}
