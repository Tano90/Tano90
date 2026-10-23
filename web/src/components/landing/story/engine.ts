import * as THREE from "three";
import { buildWorld, type ScreenAnchor, type World } from "./world";

// Camera choreography for the scroll story. One progress value t (0…1) drives everything: the camera position and
// target come from two smooth Catmull-Rom splines through key poses; key poses that "fill" a screen are computed from
// the real screen geometry, so the dashboard in the opening frame is exactly the laptop screen of the 3D office.

type Key = { t: number; pos: THREE.Vector3; target: THREE.Vector3; wide?: boolean };
const FOV = 38;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Camera pose in which the screen fills the view (contained, with a small margin). */
function fill(a: ScreenAnchor, aspect: number, margin: number) {
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const d = Math.max(a.height / 2 / tan, a.width / 2 / (tan * aspect)) * margin;
  return { pos: a.center.clone().addScaledVector(a.normal, d), target: a.center.clone() };
}

export function keyframes(w: World, aspect: number): Key[] {
  const L = w.laptop, P = w.phone;
  const near = (a: ScreenAnchor, d: number, lift: number) => ({ pos: a.center.clone().addScaledVector(a.normal, d).add(v(0, lift, 0)), target: a.center.clone().add(v(0, -lift * 0.3, 0)) });
  const keys: Key[] = [
    { t: 0.0, ...fill(L, aspect, 1.0) }, // 1 in the tool
    { t: 0.1, ...fill(L, aspect, 1.06) },
    { t: 0.2, ...near(L, 0.85, 0.16) }, // 2 out of the screen: the laptop on the desk
    { t: 0.29, pos: v(-6.5, 2.25, -3.35), target: v(-9.4, 0.7, -6.9) }, // the office
    { t: 0.38, pos: v(-5.5, 11, 8), target: v(-3.5, 0, -2.5), wide: true }, // 3 rising out of the office
    { t: 0.47, pos: v(7, 29, 27), target: v(0, 0, 0.5), wide: true }, // the whole restaurant from above
    { t: 0.56, pos: v(-2.4, 4.6, 12.5), target: P.center.clone(), wide: true }, // 4 down to the front of the dining room
    { t: 0.62, ...near(P, 0.55, 0.12) }, // the service station with the phone
    { t: 0.69, ...fill(P, aspect, aspect < 0.9 ? 1.14 : 1.02) }, // 5 into the mobile app
    { t: 0.75, ...fill(P, aspect, aspect < 0.9 ? 1.2 : 1.08) },
    { t: 0.8, pos: v(-3.6, 1.7, 3.4), target: v(-0.6, 0.8, -3.2) }, // 6 restaurant
    { t: 0.855, pos: v(3.0, 1.85, -0.6), target: v(8.6, 1.0, -5.6) }, // bar
    { t: 0.91, pos: v(4.1, 3.0, 9.0), target: v(8.6, 0.4, 3.8) }, // banquet
    { t: 0.955, pos: v(-2, 23, 23), target: v(-0.5, 0, 0), wide: true }, // 7 all areas together
    { t: 0.982, pos: v(-9.05, 2.7, -3.7), target: L.center.clone() }, // back into the office
    { t: 1.0, ...fill(L, aspect, 1.0) }, // the shared dashboard
  ];
  // portrait screens: wide shots step further back so the building fits
  if (aspect < 0.9) {
    const f = aspect < 0.65 ? 1.55 : 1.25;
    for (const k of keys) if (k.wide) k.pos = k.target.clone().add(k.pos.clone().sub(k.target).multiplyScalar(f));
  }
  return keys;
}

const ease = (s: number) => s * s * s * (s * (s * 6 - 15) + 10); // smootherstep: no jerk at the key poses

export class Path {
  private pos: THREE.CatmullRomCurve3;
  private target: THREE.CatmullRomCurve3;
  constructor(private keys: Key[]) {
    this.pos = new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, "centripetal");
    this.target = new THREE.CatmullRomCurve3(keys.map((k) => k.target), false, "centripetal");
  }
  at(t: number, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
    const k = this.keys, n = k.length - 1;
    const tt = THREE.MathUtils.clamp(t, 0, 1);
    let i = 0;
    while (i < n - 1 && tt > k[i + 1].t) i++;
    const s = ease(THREE.MathUtils.clamp((tt - k[i].t) / (k[i + 1].t - k[i].t), 0, 1));
    const u = (i + s) / n;
    this.pos.getPoint(u, outPos);
    this.target.getPoint(u, outTarget);
  }
}

export type Engine = {
  setProgress: (t: number) => void;
  resize: () => void;
  project: (id: string) => { x: number; y: number; visible: boolean } | null;
  dispose: () => void;
};

export async function createEngine(canvas: HTMLCanvasElement, opts: { lite: boolean; onFirstFrame: () => void }): Promise<Engine> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.lite, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !opts.lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const loader = new THREE.TextureLoader();
  const tex = (url: string) =>
    loader.loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.generateMipmaps = true;
      return t;
    });
  const [dashboard, mobile] = await Promise.all([tex("/story/screen-dashboard.jpg"), tex("/story/screen-mobile.jpg")]);
  const world = buildWorld(renderer, { dashboard, mobile }, opts.lite);
  // shadows are static: render the shadow map once, not every frame
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 120);
  let path = new Path(keyframes(world, 1.6));
  let progress = 0;
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  let first = true;

  function render() {
    path.at(progress, p, q);
    camera.position.copy(p);
    camera.lookAt(q);
    renderer.render(world.scene, camera);
    if (first) {
      first = false;
      opts.onFirstFrame();
    }
  }
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    path = new Path(keyframes(world, camera.aspect));
    render();
  }
  resize();

  return {
    setProgress(t) {
      progress = t;
      render();
    },
    resize,
    project(id) {
      const z = world.zones.find((x) => x.id === id);
      if (!z) return null;
      const s = z.at.clone().project(camera);
      return { x: (s.x + 1) / 2, y: (1 - s.y) / 2, visible: s.z < 1 && Math.abs(s.x) < 1.1 && Math.abs(s.y) < 1.1 };
    },
    dispose() {
      world.dispose();
      dashboard.dispose();
      mobile.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
