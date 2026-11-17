// Sky dome, sunset lighting, layered distant ridges, sea of clouds, and a pavilion on a far outcrop.
import * as THREE from "three";
import { mulberry32, hash } from "./rng.js";

export const SUN_DIR = new THREE.Vector3(-0.72, 0.42, 0.55).normalize(); // low warm sun from the upper left, behind the camera: faces are lit

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 horizon = vec3(0.97, 0.80, 0.66), mid = vec3(0.80, 0.75, 0.82), top = vec3(0.52, 0.63, 0.82);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.7, h));
        float s = max(dot(vDir, sunDir), 0.0);
        c += vec3(1.0, 0.72, 0.42) * (pow(s, 8.0) * 0.45 + pow(s, 200.0) * 1.5);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.renderOrder = -10;
  return m;
}

// a band of ridgeline around the viewer, between azimuths a0..a1 (0 = -z, +90deg = +x)
function ridgeBand(R, color, seed, a0, a1, baseY, amp) {
  const rnd = mulberry32(seed);
  const N = 220, pos = [], idx = [];
  const peaks = Array.from({ length: 7 }, () => [a0 + rnd() * (a1 - a0), 0.4 + rnd() * 0.6, 0.05 + rnd() * 0.12]);
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N;
    let h = 0;
    for (const [pa, ph, pw] of peaks) h = Math.max(h, ph * Math.exp(-(((a - pa) / pw) ** 2)));
    h += 0.08 * Math.sin(a * 37 + seed) + 0.05 * Math.sin(a * 91 + seed * 2) + (hash(i, seed) - 0.5) * 0.02;
    const x = Math.sin(a) * R, z = -Math.cos(a) * R;
    pos.push(x, baseY - R * 0.4, z, x, baseY + amp * R * h, z);
    if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // vertical haze gradient: brighter at the foot of each ridge (mist), body colour above
  const col = [];
  const base = new THREE.Color(color), mist = new THREE.Color("#f3dccb");
  for (let i = 0; i <= N; i++) { const lo = base.clone().lerp(mist, 0.55); col.push(lo.r, lo.g, lo.b, base.r, base.g, base.b); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  return m;
}

function cloudTex(seed) {
  const rnd = mulberry32(seed);
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d");
  for (let i = 0; i < 220; i++) {
    const x = rnd() * 1024, y = 40 + rnd() * 60, r = 20 + rnd() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(255,240,232,0.55)");
    grd.addColorStop(1, "rgba(255,240,232,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function pavilion() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: "#8e2f22", roughness: 0.7 });
  const roofM = new THREE.MeshStandardMaterial({ color: "#3e3936", roughness: 0.8 });
  const stone = new THREE.MeshStandardMaterial({ color: "#8a8378", roughness: 1 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 2.2), stone));
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), red);
    p.position.set(x, 0.85, z);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.9, 4, 1), roofM);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.95;
  roof.scale.set(1, 1, 1);
  g.add(roof);
  for (const a of [0, 1, 2, 3]) { // upturned eaves
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), roofM);
    const ang = Math.PI / 4 + (a * Math.PI) / 2;
    e.position.set(Math.cos(ang) * 1.25, 1.6, Math.sin(ang) * 1.25);
    e.rotation.set(Math.sin(ang) * 1.0, 0, -Math.cos(ang) * 1.0);
    g.add(e);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), roofM);
  knob.position.y = 2.45;
  g.add(knob);
  return g;
}

export function createSky(scene) {
  scene.background = new THREE.Color("#f2cfae");
  scene.fog = new THREE.Fog("#efcdb0", 16, 95);
  scene.add(skyDome());

  // distant ridges: nearer = greener/darker, farther = bluer/paler
  const layers = [[34, "#5d7448", 1, -1.3, 2.2, -4, 0.2], [52, "#748a6c", 2, -1.5, 2.4, -4, 0.19], [80, "#8b9cab", 3, -1.7, 2.6, -5, 0.17],
    [120, "#a3b2ca", 4, -1.9, 2.8, -6, 0.15], [180, "#bcc6db", 5, -2.0, 2.9, -8, 0.12]];
  const clouds = [];
  for (const [R, col, seed, a0, a1, y, amp] of layers) {
    scene.add(ridgeBand(R, col, seed, a0, a1, y, amp));
    // mist band in front of this ridge
    const tex = cloudTex(seed + 10);
    tex.repeat.set(3, 1);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R - 3, R - 3, R * 0.07, 96, 1, true, Math.PI + a0, a1 - a0),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    band.position.y = y + R * 0.06;
    scene.add(band);
    clouds.push(tex);
  }

  // pavilion on a rocky outcrop on the nearest ridge, to the right
  const pa = 0.95, PR = 44;
  const outcrop = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 3.4, 7, 7), new THREE.MeshStandardMaterial({ color: "#6f7360", roughness: 1, flatShading: true }));
  outcrop.position.set(Math.sin(pa) * PR, -3.5, -Math.cos(pa) * PR);
  scene.add(outcrop);
  const pv = pavilion();
  pv.position.set(Math.sin(pa) * PR, 0.0, -Math.cos(pa) * PR);
  pv.scale.setScalar(0.7);
  scene.add(pv);

  // lights: low warm sun with shadows, cool sky fill, warm bounce
  const hemi = new THREE.HemisphereLight("#d6e0f2", "#9a6a44", 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffc690", 3.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight("#ffe0c0", 0.6);
  rim.position.copy(SUN_DIR).multiplyScalar(-10).setY(4);
  scene.add(rim);

  return {
    sun,
    // keep the shadow frustum centred on the action
    focus(center) {
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(SUN_DIR, 25);
      sun.target.updateMatrixWorld();
    },
    update(t) { clouds.forEach((c, i) => (c.offset.x = t * (0.002 + i * 0.0006))); },
  };
}
