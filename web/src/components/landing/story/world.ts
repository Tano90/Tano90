import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// One restaurant, one floor plan (metres, y up, +z towards the street):
//   office   x -12…-6, z -8…-3   (back left, desk with the laptop)
//   dining   x  -6…4,  z -8…8    (restaurant, service station with the phone at the front)
//   bar      x   4…12, z -8…0    (counter, stools, back shelf)
//   banquet  x   4…12, z  0…8    (long tables, lighter floor)
// Walls are kept low or left out on the street sides so the camera never has to pass through anything solid.
// Everything is built here from simple geometry; no external models, textures or HDRIs are loaded.

export type ScreenAnchor = { center: THREE.Vector3; normal: THREE.Vector3; up: THREE.Vector3; width: number; height: number };
export type World = {
  scene: THREE.Scene;
  laptop: ScreenAnchor;
  phone: ScreenAnchor;
  zones: { id: "restaurant" | "bar" | "bankett" | "buero"; label: string; at: THREE.Vector3 }[];
  dispose: () => void;
};

const disposables: { dispose: () => void }[] = [];
const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

// ---------- procedural textures (canvas), so nothing has to be downloaded
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = keep(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const woodTexture = (base: string, dark: string, repeat: number) =>
  canvasTexture(
    512,
    512,
    (g) => {
      const r = rand(7);
      g.fillStyle = base;
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 8; i++) {
        // planks
        g.fillStyle = i % 2 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.03)";
        g.fillRect(0, i * 64, 512, 64);
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(0, i * 64, 512, 1.5);
        const off = r() * 512;
        g.fillRect(off, i * 64, 1.5, 64);
      }
      g.strokeStyle = dark;
      g.globalAlpha = 0.18;
      for (let i = 0; i < 160; i++) {
        const y = r() * 512;
        g.lineWidth = 0.6 + r() * 1.2;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(170, y + r() * 6 - 3, 340, y + r() * 6 - 3, 512, y + r() * 4 - 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    },
    repeat,
  );
const stoneTexture = (base: string, repeat: number) =>
  canvasTexture(
    512,
    512,
    (g) => {
      const r = rand(13);
      g.fillStyle = base;
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "60,50,40"},${0.03 + r() * 0.05})`;
        const s = 1 + r() * 3;
        g.fillRect(r() * 512, r() * 512, s, s);
      }
      g.strokeStyle = "rgba(80,70,60,0.18)";
      g.lineWidth = 1.2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * 128, 0);
        g.lineTo(i * 128, 512);
        g.moveTo(0, i * 128);
        g.lineTo(512, i * 128);
        g.stroke();
      }
    },
    repeat,
  );

// ---------- materials (warm wood, light stone, quiet metal, brand petrol)
function materials(lite: boolean) {
  const std = (o: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(o));
  return {
    oak: std({ map: woodTexture("#b98a5e", "#5a3a1e", 1), roughness: 0.62 }),
    walnut: std({ map: woodTexture("#7a5236", "#3a2414", 1), roughness: 0.55 }),
    floorWood: std({ map: woodTexture("#c49a6c", "#6b4526", 6), roughness: 0.7 }),
    floorStone: std({ map: stoneTexture("#d9d1c4", 5), roughness: 0.85 }),
    floorLight: std({ map: stoneTexture("#ece5d8", 5), roughness: 0.9 }),
    floorOffice: std({ color: "#8f9a92", roughness: 0.95 }),
    plaster: std({ color: "#efe7da", roughness: 0.95 }),
    plasterWarm: std({ color: "#e6d9c4", roughness: 0.95 }),
    stoneTop: std({ map: stoneTexture("#e9e4dc", 1), roughness: 0.35 }),
    metal: std({ color: "#3a3d3f", metalness: 0.8, roughness: 0.35 }),
    brass: std({ color: "#b8925a", metalness: 0.9, roughness: 0.3 }),
    petrol: std({ color: "#116c63", roughness: 0.6 }),
    petrolDark: std({ color: "#0d4f49", roughness: 0.7 }),
    linen: std({ color: "#f6f2ea", roughness: 0.95 }),
    leather: std({ color: "#7b4b32", roughness: 0.6 }),
    fabric: std({ color: "#c9b79c", roughness: 1 }),
    leaf: std({ color: "#5d7a55", roughness: 0.9, flatShading: true }),
    pot: std({ color: "#cdb59a", roughness: 0.9 }),
    glass: keep(new THREE.MeshPhysicalMaterial({ color: "#dfe9e6", roughness: 0.05, transparent: true, opacity: lite ? 0.18 : 0.22, metalness: 0 })),
    bottleA: std({ color: "#5c7a4a", roughness: 0.2, transparent: true, opacity: 0.85 }),
    bottleB: std({ color: "#a8743a", roughness: 0.2, transparent: true, opacity: 0.85 }),
    bottleC: std({ color: "#e7e1d4", roughness: 0.2, transparent: true, opacity: 0.85 }),
    darkPlastic: std({ color: "#1d2326", roughness: 0.5 }),
    alu: std({ color: "#c7cacc", metalness: 0.7, roughness: 0.32 }),
    lamp: keep(new THREE.MeshStandardMaterial({ color: "#fff3dc", emissive: "#ffcf8a", emissiveIntensity: 2.2 })),
    ground: std({ color: "#d8cdb9", roughness: 1 }),
    terrace: std({ map: stoneTexture("#cfc5b4", 8), roughness: 0.95 }),
  };
}
type M = ReturnType<typeof materials>;

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, shadow = true) {
  const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function rbox(w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
  const mesh = new THREE.Mesh(keep(new RoundedBoxGeometry(w, h, d, 3, r)), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, seg = 20) {
  const mesh = new THREE.Mesh(keep(new THREE.CylinderGeometry(rt, rb, h, seg)), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ---------- furniture
function chair(m: M, x: number, z: number, rot: number, parent: THREE.Object3D, seat = m.fabric) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  rbox(0.44, 0.06, 0.42, 0.02, seat, 0, 0.46, 0, g);
  rbox(0.44, 0.42, 0.05, 0.02, m.oak, 0, 0.7, -0.19, g);
  for (const [lx, lz] of [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]]) cyl(0.015, 0.015, 0.44, m.metal, lx, 0.22, lz, g, 8);
  parent.add(g);
}
function roundTable(m: M, x: number, z: number, parent: THREE.Object3D, chairs = 4) {
  cyl(0.45, 0.45, 0.04, m.oak, x, 0.74, z, parent, 32);
  cyl(0.04, 0.04, 0.72, m.metal, x, 0.37, z, parent, 10);
  cyl(0.22, 0.24, 0.03, m.metal, x, 0.015, z, parent, 20);
  // small table lamp / candle: warm dot of light
  cyl(0.03, 0.035, 0.08, m.lamp, x, 0.8, z, parent, 10);
  for (let i = 0; i < chairs; i++) {
    const a = (i / chairs) * Math.PI * 2 + Math.PI / 4;
    chair(m, x + Math.sin(a) * 0.75, z + Math.cos(a) * 0.75, a + Math.PI, parent);
  }
}
function pendant(m: M, x: number, y: number, z: number, parent: THREE.Object3D) {
  cyl(0.006, 0.006, 3.2 - y, m.metal, x, y + (3.2 - y) / 2, z, parent, 6);
  const shade = new THREE.Mesh(keep(new THREE.ConeGeometry(0.22, 0.2, 24, 1, true)), m.brass);
  shade.position.set(x, y + 0.08, z);
  parent.add(shade);
  const bulb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.06, 12, 8)), m.lamp);
  bulb.position.set(x, y, z);
  parent.add(bulb);
}
function plant(m: M, x: number, z: number, parent: THREE.Object3D, s = 1) {
  cyl(0.2 * s, 0.16 * s, 0.4 * s, m.pot, x, 0.2 * s, z, parent, 16);
  const r = rand(Math.round(x * 100 + z * 7));
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.22 * s, 0)), m.leaf);
    leaf.position.set(x + (r() - 0.5) * 0.3 * s, (0.55 + r() * 0.45) * s, z + (r() - 0.5) * 0.3 * s);
    leaf.scale.set(1, 1.3, 1);
    leaf.castShadow = true;
    parent.add(leaf);
  }
}

// ---------- devices with real screens
function screenMaterial(tex: THREE.Texture) {
  return keep(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
}
function laptop(m: M, tex: THREE.Texture, x: number, y: number, z: number, parent: THREE.Object3D) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const W = 0.34, D = 0.235;
  rbox(W, 0.016, D, 0.006, m.alu, 0, 0.008, 0, g);
  box(W * 0.86, 0.002, D * 0.42, m.darkPlastic, 0, 0.0165, -0.02, g, false); // keyboard
  box(W * 0.3, 0.001, D * 0.2, m.metal, 0, 0.0165, 0.07, g, false); // trackpad
  // lid hinged at the back edge, opened ~105°
  const lid = new THREE.Group();
  lid.position.set(0, 0.016, -D / 2);
  lid.rotation.x = -0.26;
  g.add(lid);
  rbox(W, 0.225, 0.008, 0.006, m.alu, 0, 0.1125, -0.004, lid);
  box(W - 0.012, 0.213, 0.001, m.darkPlastic, 0, 0.1125, 0.0006, lid, false); // bezel
  const sw = W - 0.03, sh = sw / 1.6; // 16:10, as the screenshot
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(sw, sh)), screenMaterial(tex));
  screen.position.set(0, 0.116, 0.0013);
  lid.add(screen);
  return { screen, width: sw, height: sh };
}
function phone(m: M, tex: THREE.Texture, x: number, y: number, z: number, rotY: number, parent: THREE.Object3D) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  // small stand on the service station, phone leaning back slightly
  rbox(0.09, 0.012, 0.08, 0.004, m.walnut, 0, 0.006, 0, g);
  const body = new THREE.Group();
  body.position.set(0, 0.012, -0.012);
  body.rotation.x = -0.24;
  g.add(body);
  rbox(0.076, 0.158, 0.008, 0.008, m.darkPlastic, 0, 0.079, 0, body);
  const sh = 0.148, sw = sh * (390 / 844);
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(sw, sh)), screenMaterial(tex));
  screen.position.set(0, 0.079, 0.0042);
  body.add(screen);
  return { screen, width: sw, height: sh };
}
function anchorOf(mesh: THREE.Mesh, width: number, height: number): ScreenAnchor {
  mesh.updateWorldMatrix(true, false);
  const center = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
  const q = new THREE.Quaternion();
  mesh.getWorldQuaternion(q);
  return {
    center,
    normal: new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
    width,
    height,
  };
}

// ---------- the building
export function buildWorld(renderer: THREE.WebGLRenderer, screens: { dashboard: THREE.Texture; mobile: THREE.Texture }, lite: boolean): World {
  disposables.length = 0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#efe7da");
  scene.fog = new THREE.Fog("#efe7da", 38, 75);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  disposables.push(env);
  const m = materials(lite);
  const root = new THREE.Group();
  scene.add(root);

  // ground, terrace and the building slab
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(140, 140)), m.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  root.add(ground);
  box(30, 0.08, 4, m.terrace, -0.5, -0.02, 10.2, root, false);
  box(26, 0.12, 18, m.plaster, -0.5, -0.06, 0, root, false);
  // floors per zone
  box(6, 0.02, 5, m.floorOffice, -9, 0.01, -5.5, root, false);
  box(6, 0.02, 5, m.floorWood, -9, 0.01, 0, root, false); // corridor / entrance part of dining
  box(3, 0.02, 3, m.floorWood, -10.5, 0.01, 4.5, root, false);
  box(10, 0.02, 16, m.floorWood, -1, 0.01, 0, root, false);
  box(8, 0.02, 8, m.floorStone, 8, 0.01, -4, root, false);
  box(8, 0.02, 8, m.floorLight, 8, 0.01, 4, root, false);

  // exterior walls: full height at the back (north) and left (west); the street sides stay open (glass front, low parapet)
  const H = 3;
  box(24.4, H, 0.2, m.plaster, 0, H / 2, -8.1, root);
  box(0.2, H, 16.4, m.plaster, -12.1, H / 2, 0, root);
  box(0.2, 1, 8, m.plasterWarm, 12.1, 0.5, -4, root);
  box(0.2, 1, 8, m.plasterWarm, 12.1, 0.5, 4, root);
  box(24.4, 0.5, 0.2, m.plasterWarm, 0, 0.25, 8.1, root); // low parapet at the front
  for (let x = -11; x <= 11; x += 2.75) box(0.08, H, 0.08, m.metal, x, H / 2, 8.1, root); // slim mullions of the glass front
  // window openings in the back wall: warm glow panels
  for (const x of [-2.5, 1.5, 6.5, 9.5]) box(1.6, 1.4, 0.02, m.lamp, x, 1.7, -7.99, root, false);

  // office: partition walls to dining (east) with door, glass towards the front (south)
  box(0.15, H, 3.2, m.plasterWarm, -6, H / 2, -6.4, root);
  box(0.15, 0.6, 1.8, m.plasterWarm, -6, H - 0.3, -3.9, root); // door lintel
  box(6, H, 0.02, m.glass, -9, H / 2, -3, root, false);
  box(6, 0.06, 0.08, m.metal, -9, H, -3, root, false);
  box(6, 0.06, 0.08, m.metal, -9, 0.03, -3, root, false);
  // desk along the back wall, chair, shelf, plant, wall clock
  rbox(1.8, 0.04, 0.75, 0.01, m.oak, -9, 0.74, -7.2, root);
  for (const dx of [-0.85, 0.85]) box(0.04, 0.72, 0.68, m.metal, -9 + dx, 0.36, -7.2, root);
  const lp = laptop(m, screens.dashboard, -9.05, 0.76, -7.1, root);
  box(0.2, 0.26, 0.16, m.petrolDark, -9.82, 0.89, -7.42, root); // binder box
  cyl(0.04, 0.035, 0.1, m.linen, -8.4, 0.81, -7.0, root, 14); // cup
  chair(m, -9.05, -6.3, Math.PI, root, m.leather);
  const shelf = new THREE.Group();
  shelf.position.set(-11.75, 0, -5.4);
  root.add(shelf);
  box(0.4, 2, 1.6, m.walnut, 0, 1, 0, shelf);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) box(0.25, 0.28, 0.06, j % 2 ? m.petrol : m.fabric, 0.05, 0.3 + i * 0.45, -0.6 + j * 0.28, shelf, false);
  plant(m, -6.6, -7.5, root, 1.2);
  cyl(0.22, 0.22, 0.03, m.linen, -9, 2.2, -7.98, root).rotation.x = Math.PI / 2; // wall clock

  // dining: round tables in a loose grid, banquettes along the back wall, pendants
  const dining = new THREE.Group();
  root.add(dining);
  const tables = lite
    ? [[-4, -5], [-1, -5], [2, -5], [-4, -1.5], [-1, -1.5], [2, -1.5], [-1, 2]]
    : [[-4, -5.2], [-1, -5.2], [2, -5.2], [-4, -1.8], [-1, -1.8], [2, -1.8], [-4, 1.6], [-1, 1.6], [2, 1.6]];
  for (const [x, z] of tables) {
    roundTable(m, x, z, dining, lite ? 2 : 4);
    if (!lite) pendant(m, x, 2.1, z, dining);
  }
  rbox(8.6, 0.5, 0.6, 0.05, m.leather, -1, 0.45, -7.55, dining); // banquette seat
  rbox(8.6, 0.6, 0.15, 0.05, m.leather, -1, 0.95, -7.85, dining);
  plant(m, -5.5, 6.8, dining, 1.4);
  plant(m, 3.4, 6.8, dining, 1.1);
  // service station at the front of the dining room: counter, POS-free; the phone with the tasks of the suite
  rbox(1.8, 0.95, 0.6, 0.02, m.walnut, -2.2, 0.475, 5.6, dining);
  rbox(1.9, 0.04, 0.68, 0.01, m.stoneTop, -2.2, 0.97, 5.6, dining);
  for (let i = 0; i < 4; i++) cyl(0.035, 0.03, 0.1, m.linen, -2.85 + i * 0.12, 1.04, 5.75, dining, 12); // glasses
  box(0.32, 0.03, 0.22, m.linen, -1.5, 1.005, 5.7, dining); // order pad
  const ph = phone(m, screens.mobile, -2.15, 0.99, 5.55, 0, dining);

  // bar: counter (stone top, brass foot rail), stools, back shelf with bottles, low partition to the dining room
  const bar = new THREE.Group();
  root.add(bar);
  box(0.15, 1.2, 8, m.plasterWarm, 4, 0.6, -4, bar);
  rbox(5.5, 1.08, 0.7, 0.03, m.walnut, 8, 0.54, -3.5, bar);
  rbox(5.7, 0.05, 0.85, 0.01, m.stoneTop, 8, 1.1, -3.5, bar);
  cyl(0.02, 0.02, 5.5, m.brass, 8, 0.22, -3.05, bar, 8).rotation.z = Math.PI / 2;
  for (let i = 0; i < (lite ? 4 : 6); i++) {
    const x = 5.8 + i * (lite ? 1.4 : 0.9);
    cyl(0.2, 0.2, 0.06, m.leather, x, 0.78, -2.7, bar, 18);
    cyl(0.025, 0.025, 0.76, m.metal, x, 0.38, -2.7, bar, 8);
    cyl(0.16, 0.18, 0.02, m.metal, x, 0.01, -2.7, bar, 16);
  }
  box(6, 2.4, 0.4, m.walnut, 8, 1.2, -7.7, bar);
  for (let s = 0; s < 3; s++) {
    box(5.6, 0.03, 0.36, m.oak, 8, 0.9 + s * 0.5, -7.45, bar, false);
    if (!lite)
      for (let i = 0; i < 16; i++) {
        const mat = [m.bottleA, m.bottleB, m.bottleC][(i + s) % 3];
        cyl(0.04, 0.045, 0.3, mat, 5.4 + i * 0.34, 1.07 + s * 0.5, -7.45, bar, 10);
      }
  }
  for (const x of [6.2, 8, 9.8]) pendant(m, x, 2.0, -3.5, bar);

  // banquet: lighter floor, long tables with linen, small lectern, divider to the bar
  const banquet = new THREE.Group();
  root.add(banquet);
  for (let x = 4.5; x < 12; x += 1.1) cyl(0.03, 0.03, 2.2, m.oak, x, 1.1, 0, banquet, 8); // slatted divider
  box(7.6, 0.06, 0.08, m.oak, 8.25, 2.2, 0, banquet, false);
  for (const z of [2.4, 5.4]) {
    rbox(6, 0.05, 1.0, 0.01, m.linen, 8, 0.76, z, banquet);
    box(6.02, 0.5, 1.02, m.linen, 8, 0.5, z, banquet);
    for (let i = 0; i < (lite ? 3 : 6); i++) {
      const x = 5.5 + i * (lite ? 2.5 : 1);
      chair(m, x, z - 0.8, 0, banquet, m.petrol);
      chair(m, x, z + 0.8, Math.PI, banquet, m.petrol);
      if (!lite) cyl(0.03, 0.03, 0.18, m.lamp, x, 0.88, z, banquet, 8);
    }
  }
  box(0.6, 1.1, 0.4, m.walnut, 11.3, 0.55, 7.2, banquet); // lectern
  for (const x of [6, 10]) pendant(m, x, 2.3, 4, banquet);

  // outside: a few trees on the street side
  for (const [x, z] of lite ? [[-8, 12], [8, 12]] : [[-10, 12.5], [-3, 13], [4, 12.5], [11, 13]]) {
    cyl(0.12, 0.16, 1.6, m.walnut, x, 0.8, z, root, 8);
    const crown = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1.2, 1)), m.leaf);
    crown.position.set(x, 2.4, z);
    crown.castShadow = !lite;
    root.add(crown);
  }

  // light: warm sun from the front left, soft sky, warm interior fill
  scene.add(new THREE.HemisphereLight("#fff6e8", "#b8a68c", 0.9));
  const sun = new THREE.DirectionalLight("#ffe7c4", 2.0);
  sun.position.set(-14, 22, 16);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  if (!lite) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
  }
  for (const [x, z, c] of [[-9, -5.5, "#ffe2b8"], [-1, -2, "#ffd29a"], [8, -4, "#ffc98a"], [8, 4, "#fff0d8"]] as const) {
    const p = new THREE.PointLight(c, 6, 9, 1.6);
    p.position.set(x, 2.6, z);
    scene.add(p);
  }

  return {
    scene,
    laptop: anchorOf(lp.screen, lp.width, lp.height),
    phone: anchorOf(ph.screen, ph.width, ph.height),
    zones: [
      { id: "buero", label: "Büro", at: new THREE.Vector3(-9, 0.4, -5) },
      { id: "restaurant", label: "Restaurant", at: new THREE.Vector3(-1, 0.4, -0.2) },
      { id: "bar", label: "Bar", at: new THREE.Vector3(8, 0.4, -4.6) },
      { id: "bankett", label: "Bankett", at: new THREE.Vector3(8, 0.4, 4) },
    ],
    dispose: () => {
      for (const d of disposables) d.dispose();
      disposables.length = 0;
    },
  };
}
