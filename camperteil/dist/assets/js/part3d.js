/* Camperteil: WebGL-Ansicht der Beispiel-Abdeckung (Three.js, lokal).
   Rendert nur, wenn sich etwas bewegt und die Bühne sichtbar ist.
   Schnittstelle identisch mit software3d.js, damit experience.js beide gleich bedienen kann. */
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

export const PALETTE = {
  sand: { color: 0xcbbd9f, roughness: 0.52, clearcoat: 0.3 },
  olive: { color: 0x68705a, roughness: 0.58, clearcoat: 0.22 },
  graphite: { color: 0x3a3f3b, roughness: 0.44, clearcoat: 0.38 }
};

const REST = { radius: 12.4, theta: 0.52, phi: 1.22 };
// Feste Blickwinkel zur Orientierung; „vorne“ blickt senkrecht auf das nach hinten geneigte Teil
const VIEWS = { schraeg: REST, vorne: { radius: 12.4, theta: 0, phi: 1.37 }, seite: { radius: 12.4, theta: 1.52, phi: 1.37 } };
const LIMITS = { minRadius: 7, maxRadius: 19, minPhi: 0.35, maxPhi: 1.62 };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createWebGLViewer({ stage, canvas, coarse, reduced, onLabels, onLost, onTooSlow }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !coarse || devicePixelRatio < 2, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  /* Licht: kleines Fotostudio als Umgebung, damit Kunststoff und Metall glaubwürdig reflektieren */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: 0x33463b, side: THREE.BackSide })));
  const panel = (w, h, hex, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); studio.add(m);
  };
  panel(5, 3.2, 0xfff0d8, 7, [3.5, 5, 4.5]);     // warmes Hauptlicht, Abendsonne durch die Markise
  panel(9, 4, 0xf3eee2, 2.2, [0, 6.5, 0]);        // weite Deckenfläche für ruhige Reflexe auf Metall
  panel(3, 6, 0xcfe4ff, 3.5, [-5.5, 2, -3]);     // kühles Gegenlicht
  panel(8, 2, 0x8a9a74, 1.1, [0, -5.5, 2]);      // Grün vom Boden
  panel(7, 4, 0xe6ece0, 1.4, [2, 1.5, 6.5]);      // leichte Aufhellung von vorn, damit Schraubenköpfe nicht schwarz spiegeln
  scene.environment = pmrem.fromScene(studio, 0.035).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffeccc, 2.4);
  key.position.set(3.2, 7.5, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(coarse ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xf4ead2, 0x3f5745, 0.35));

  /* Oberfläche: feine Narbung wie bei gespritztem ABS, leicht unregelmäßig gealtert */
  const grain = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const img = g.createImageData(256, 256);
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < img.data.length; i += 4) { const v = 118 + rnd() * 34; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.5, 2.5); t.anisotropy = 4;
    return t;
  })();
  const plastic = new THREE.MeshPhysicalMaterial({ color: PALETTE.sand.color, roughness: PALETTE.sand.roughness, roughnessMap: grain, bumpMap: grain, bumpScale: 0.35, clearcoat: PALETTE.sand.clearcoat, clearcoatRoughness: 0.55 });
  const insertMat = new THREE.MeshStandardMaterial({ color: 0x4d5846, roughness: 0.78, roughnessMap: grain, bumpMap: grain, bumpScale: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd4d7d0, metalness: 1, roughness: 0.34, envMapIntensity: 1.6 });
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x2a332c, roughness: 0.6, metalness: 0.4 });

  /* Geometrie: Rahmen mit Öffnung, Einleger mit Lüftungsrippen, zwei Schrauben */
  const seg = coarse ? 12 : 24;
  const roundedRect = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };
  const SCREWS = [[-1.48, -1.66], [1.48, 1.66]];
  const root = new THREE.Group();
  root.rotation.set(-0.2, 0, 0);
  root.position.y = 0.15;
  scene.add(root);

  const frameShape = roundedRect(3.7, 4.1, 0.35);
  frameShape.holes.push(roundedRect(2.42, 2.8, 0.15));
  for (const [x, y] of SCREWS) { const p = new THREE.Path(); p.absarc(x, y, 0.12, 0, Math.PI * 2, true); frameShape.holes.push(p); }
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.28, bevelEnabled: true, bevelSegments: coarse ? 3 : 5, bevelSize: 0.065, bevelThickness: 0.065, curveSegments: seg }), plastic);
  frame.position.z = -0.14;
  const insert = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(2.39, 2.77, 0.14), { depth: 0.13, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: seg }), insertMat);
  const ribs = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.05), plastic);
    rib.position.set(0, -0.6 + i * 0.2, 0.2); ribs.add(rib);
  }
  const screws = SCREWS.map(([x, y]) => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.65, 20), metal); shaft.rotation.x = Math.PI / 2; g.add(shaft);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 32), metal); head.rotation.x = Math.PI / 2; head.position.z = 0.34; g.add(head);
    for (const rot of [0, Math.PI / 2]) { const slot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.024, 0.01), slotMat); slot.position.z = 0.384; slot.rotation.z = rot; g.add(slot); }
    g.position.set(x, y, 0.22); root.add(g); return g;
  });
  root.add(frame, insert, ribs);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // Boden: weicher Schlagschatten plus Kontaktschatten direkt unter dem Teil
  const floorY = -2.2;
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.32 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = floorY; shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);
  const contact = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62); grd.addColorStop(0, 'rgba(6,20,14,.55)'); grd.addColorStop(1, 'rgba(6,20,14,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, floorY + 0.005, 0.25); return m;
  })();
  scene.add(contact);

  /* Kamera und Steuerung */
  const target = new THREE.Vector3(0, 0, 0);
  const sph = new THREE.Spherical(REST.radius, REST.phi, REST.theta);
  const placeCamera = () => { camera.position.setFromSpherical(sph).add(target); camera.lookAt(target); };
  placeCamera();

  // Mausrad scrollt die Seite; gezoomt wird nur mit Strg/⌘ (Trackpad-Pinch sendet ebenfalls Strg)
  canvas.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); }, { capture: true });
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: !reduced, dampingFactor: 0.09, enablePan: false, minDistance: LIMITS.minRadius, maxDistance: LIMITS.maxRadius, minPolarAngle: LIMITS.minPhi, maxPolarAngle: LIMITS.maxPhi, rotateSpeed: 0.8, zoomSpeed: 0.7 });
  controls.target.copy(target);
  controls.update();
  // Senkrecht wischen bleibt Seiten-Scrollen; waagerecht dreht das Modell
  canvas.style.touchAction = 'pan-y';

  /* Zustand und Übergänge */
  const state = { explode: 0, explodeTarget: 0, wire: false, material: 'sand', auto: false };
  let explodeTween = null;
  const setExplode = (t, ms = 600) => {
    state.explodeTarget = t;
    if (reduced || !ms) { explodeTween = null; state.explode = t; } else explodeTween = { from: state.explode, to: t, start: performance.now(), ms };
    request();
  };
  const color = { from: new THREE.Color(), to: new THREE.Color(PALETTE.sand.color), t: 1 };
  let camTween = null;
  // Ziel der laufenden Bewegung, damit schnell wiederholte Tasten sich addieren statt sich zu überschreiben
  const aim = () => (camTween ? camTween.to.clone() : new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)));
  const tweenCamera = (to, ms) => {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (reduced || !ms) { sph.copy(to); placeCamera(); controls.update(); request(); return; }
    // kürzesten Drehweg wählen
    let dTheta = to.theta - from.theta; dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    camTween = { from, to: new THREE.Spherical(to.radius, to.phi, from.theta + dTheta), start: performance.now(), ms };
    request();
  };

  let visible = false, running = false, last = 0, intro = false, frames = 0, lastBusy = false;

  /* Qualität passt sich an: bei dauerhaft unter etwa 20 Bildern pro Sekunde erst Schatten und Pixeldichte senken,
     danach an die schnelle Canvas-Ansicht übergeben. Gemessen wird nur, während sich etwas bewegt. */
  let quality = 0; const gaps = [];
  const adaptive = (window.CAMPERTEIL_3D || {}).adaptive !== false; // nur für Tests abschaltbar
  const measure = (gap) => {
    if (!adaptive) return;
    gaps.push(gap); if (gaps.length < 8) return;
    const sorted = gaps.slice().sort((a, b) => a - b), median = sorted[4]; gaps.length = 0;
    if (median < 50) return;
    quality++;
    stage.dataset.quality = String(quality);
    if (quality === 1) { renderer.shadowMap.enabled = false; key.castShadow = false; shadowCatcher.visible = false; renderer.setPixelRatio(1); plastic.needsUpdate = insertMat.needsUpdate = metal.needsUpdate = true; resize(); }
    else if (quality === 2) { renderer.setPixelRatio(0.75); resize(); }
    else if (onTooSlow) { destroy(); onTooSlow(); }
  };
  const tick = (now) => {
    running = false;
    if (!visible || document.hidden) return;
    const gap = last ? now - last : 0;
    const dt = Math.min(250, gap); last = now;
    if (lastBusy && gap) measure(gap);
    let busy = false;
    if (camTween) {
      const p = Math.min(1, (now - camTween.start) / camTween.ms), e = (intro ? easeOut : easeInOut)(p);
      sph.set(THREE.MathUtils.lerp(camTween.from.radius, camTween.to.radius, e), THREE.MathUtils.lerp(camTween.from.phi, camTween.to.phi, e), THREE.MathUtils.lerp(camTween.from.theta, camTween.to.theta, e));
      placeCamera();
      if (p >= 1) { camTween = null; intro = false; }
      busy = true;
    }
    // Explosion zeitbasiert, damit sie auch bei wenigen Bildern pro Sekunde in 0,6 s ankommt
    if (explodeTween) {
      const p = Math.min(1, (now - explodeTween.start) / explodeTween.ms);
      state.explode = THREE.MathUtils.lerp(explodeTween.from, explodeTween.to, easeInOut(p));
      if (p >= 1) explodeTween = null; busy = true;
    }
    if (color.t < 1) {
      color.t = reduced ? 1 : Math.min(1, (now - color.start) / 420);
      plastic.color.copy(color.from).lerp(color.to, easeInOut(color.t)); busy = true;
    }
    const t = state.explode;
    insert.position.z = 0.03 + t * 1.0;
    ribs.position.z = t * 1.0;
    screws.forEach((g, i) => { g.position.z = 0.22 + t * (1.55 + i * 0.2); });
    contact.material.opacity = 1 - t * 0.35;
    const before = camera.position.clone();
    inTick = true; controls.update(dt / 1000); inTick = false; // Zeit übergeben: gleiche Drehgeschwindigkeit bei jeder Bildrate
    // Ausklingende Dämpfung nur zeichnen, solange man sie sieht
    if (camera.position.distanceToSquared(before) > 1e-6) busy = true;
    if (state.auto && !camTween) {
      // Eigene, zeitbasierte Drehung: hält sofort an, ohne Nachlauf
      const cur = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      cur.theta += (dt / 1000) * 0.22; camera.position.setFromSpherical(cur).add(controls.target); camera.lookAt(controls.target);
      busy = true;
    }
    renderer.render(scene, camera); frames++;
    emitLabels();
    lastBusy = busy;
    if (busy) request();
  };
  const request = () => { if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(tick); } };
  let inTick = false;
  // Nur Änderungen von außen (Ziehen, Zoomen) wecken die Schleife; die eigene Dämpfung entscheidet in tick()
  controls.addEventListener('change', () => { if (!inTick) request(); });
  controls.addEventListener('start', () => { camTween = null; request(); });

  // Beschriftungen folgen den Bauteilen, sobald sie auseinandergezogen sind
  const anchors = { frame: new THREE.Vector3(1.85, 1.2, 0.1), insert: new THREE.Vector3(-1.2, -1.1, 0.2), screws: new THREE.Vector3(0, 0, 0.4) };
  const v = new THREE.Vector3();
  const emitLabels = () => {
    const w = stage.clientWidth, h = stage.clientHeight, out = {};
    const at = (obj, local) => { v.copy(local); obj.localToWorld(v); v.project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; };
    out.frame = at(frame, anchors.frame);
    out.insert = at(insert, anchors.insert);
    out.screws = at(screws[1], anchors.screws);
    onLabels(out, Math.min(1, Math.max(0, (state.explode - 0.25) / 0.35)));
  };

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.85 ? 38 : 30; // Hochformat: etwas weiter, damit das Teil ganz sichtbar bleibt
    camera.updateProjectionMatrix(); request();
  };
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();

  // Einstieg: einmalige, ruhige Kamerafahrt in die Ausgangsansicht, sobald die Bühne ins Bild kommt
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !intro && !reduced && stage.dataset.introDone !== 'true') {
      stage.dataset.introDone = 'true'; intro = true;
      const start = new THREE.Spherical(REST.radius * 1.22, REST.phi + 0.12, REST.theta - 0.75);
      sph.copy(start); placeCamera(); controls.update();
      tweenCamera(new THREE.Spherical(REST.radius, REST.phi, REST.theta), 1700);
    }
    request();
  }, { threshold: 0.2 });
  io.observe(stage);
  const onVisibility = () => { last = 0; request(); };
  document.addEventListener('visibilitychange', onVisibility);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destroy(); onLost(); }, { once: true });

  function destroy() {
    io.disconnect(); ro.disconnect(); controls.dispose();
    document.removeEventListener('visibilitychange', onVisibility);
    visible = false;
  }

  return {
    kind: 'webgl',
    setMaterial(name) {
      const p = PALETTE[name]; if (!p) return;
      state.material = name; color.from.copy(plastic.color); color.to.setHex(p.color); color.t = 0; color.start = performance.now();
      plastic.roughness = p.roughness; plastic.clearcoat = p.clearcoat; request();
    },
    setExplode(t) { setExplode(t, Math.abs(t - state.explode) > 0.2 ? 600 : 160); },
    setAuto(on) { state.auto = on && !reduced; last = 0; request(); },
    setWire(on) { state.wire = on; for (const m of [plastic, insertMat, metal]) m.wireframe = on; request(); },
    zoomBy(f) {
      const cur = aim();
      cur.radius = THREE.MathUtils.clamp(cur.radius * f, LIMITS.minRadius, LIMITS.maxRadius); tweenCamera(cur, 260);
    },
    rotateBy(dTheta, dPhi) {
      const cur = aim();
      cur.theta += dTheta; cur.phi = THREE.MathUtils.clamp(cur.phi + dPhi, LIMITS.minPhi, LIMITS.maxPhi); tweenCamera(cur, 220);
    },
    setView(name) {
      const v = VIEWS[name]; if (!v) return;
      state.auto = false; tweenCamera(new THREE.Spherical(v.radius, v.phi, v.theta), 800);
    },
    reset() {
      state.auto = false; setExplode(0, 700);
      this.setWire(false);
      tweenCamera(new THREE.Spherical(REST.radius, REST.phi, REST.theta), 900);
    },
    // Für Tests: Kamera-Abstand und Drehwinkel
    debug() { const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)); return { radius: +s.radius.toFixed(2), theta: +s.theta.toFixed(2), phi: +s.phi.toFixed(2), explode: +state.explode.toFixed(2), color: '#' + plastic.color.getHexString(), wire: plastic.wireframe, auto: state.auto, frames, quality, visible, running }; }
  };
}
