// Tiger from code: dynamic spine tube body, painted stripes, shell fur, hinged jaw, tail chain. Faces +z.
import * as THREE from "three";
import { mulberry32 } from "./rng.js";
import { QUAD } from "./anim/gait.js";
import { MAT } from "./mats.js";

const ORANGE = "#e8862a", DARK = "#2a1a14", CREAM = "#f3e6d0";

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// tapered, wavy brush stroke
function stroke(g, rnd, x, y, len, wid, ang) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, -wid * 0.2);
  const wob = () => (rnd() - 0.5) * wid;
  g.bezierCurveTo(len * 0.3, -wid + wob(), len * 0.7, -wid * 0.8 + wob(), len, 0);
  g.bezierCurveTo(len * 0.7, wid * 0.8 + wob(), len * 0.3, wid + wob(), 0, wid * 0.2);
  g.closePath();
  g.fill();
  g.restore();
}

// body: u (x) along the body rump->neck, v (y) around, v=0 top (spine), v=0.5 belly
function bodyTex(seed) {
  const rnd = mulberry32(seed);
  return canvasTex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#d9721f");
    grd.addColorStop(0.28, ORANGE);
    grd.addColorStop(0.4, "#f0a050");
    grd.addColorStop(0.47, CREAM);
    grd.addColorStop(0.53, CREAM);
    grd.addColorStop(0.6, "#f0a050");
    grd.addColorStop(0.72, ORANGE);
    grd.addColorStop(1, "#d9721f");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = DARK;
    for (let i = 0; i < 26; i++) {
      const x = 40 + (i / 26) * (w - 60) + (rnd() - 0.5) * 18;
      const len = h * (0.2 + rnd() * 0.12), wid = 7 + rnd() * 6;
      // stripes run from the spine down each flank, stopping short of the belly
      stroke(g, rnd, x, -4, len, wid, Math.PI / 2 + (rnd() - 0.5) * 0.35);
      stroke(g, rnd, x, h + 4, len, wid, -Math.PI / 2 + (rnd() - 0.5) * 0.35);
      if (rnd() < 0.5) stroke(g, rnd, x + 14, h * 0.18, len * 0.5, wid * 0.7, Math.PI / 2 + 0.3);
      if (rnd() < 0.5) stroke(g, rnd, x + 14, h * 0.82, len * 0.5, wid * 0.7, -Math.PI / 2 - 0.3);
    }
  });
}

// legs/tail: v along the limb; bands across, cream toward the paw
function limbTex(seed, { creamFrom = 0.7, bands = 5 } = {}) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, ORANGE);
    grd.addColorStop(creamFrom, "#efa458");
    grd.addColorStop(Math.min(1, creamFrom + 0.15), CREAM);
    grd.addColorStop(1, CREAM);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = DARK;
    for (let i = 0; i < bands; i++) {
      const y = (h * creamFrom * (i + 0.5)) / bands;
      stroke(g, rnd, -4, y, w * (0.4 + rnd() * 0.2), 6 + rnd() * 4, (rnd() - 0.5) * 0.3);
      stroke(g, rnd, w + 4, y + 8, w * (0.35 + rnd() * 0.2), 6 + rnd() * 4, Math.PI + (rnd() - 0.5) * 0.3);
    }
  });
}

// head sphere: u around (front = 0.25), v top->bottom
function headTex(seed) {
  const rnd = mulberry32(seed);
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = ORANGE;
    g.fillRect(0, 0, w, h);
    const fx = w * 0.25;
    // white around eyes / cheeks / chin
    g.fillStyle = CREAM;
    for (const dx of [-0.07, 0.07]) {
      g.beginPath();
      g.ellipse(fx + dx * w, h * 0.52, w * 0.07, h * 0.12, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(fx - w * 0.16, h * 0.6, w * 0.32, h * 0.4);
    // forehead stripes
    g.fillStyle = DARK;
    for (let i = -3; i <= 3; i++) {
      stroke(g, rnd, fx + i * w * 0.025, h * 0.08, h * (0.18 - Math.abs(i) * 0.02), 5, Math.PI / 2 + i * 0.12);
    }
    // cheek / side stripes
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      stroke(g, rnd, fx + side * w * (0.12 + i * 0.03), h * (0.45 + i * 0.03), w * 0.06, 5, side > 0 ? 0.25 : Math.PI - 0.25);
    }
    // eye-brow dark marks
    for (const dx of [-0.05, 0.05]) stroke(g, rnd, fx + dx * w - w * 0.02, h * 0.36, w * 0.04, 4, dx > 0 ? -0.3 : 0.3);
  });
}

function furNoise(seed) {
  const rnd = mulberry32(seed);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.floor(rnd() * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// shell fur: copies of a mesh pushed out along normals, alpha-tested strands getting sparser outward
function addShells(mesh, n, length, noise, repeat) {
  const shells = [];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const mat = mesh.material.clone();
    mat.alphaMap = noise.clone();
    mat.alphaMap.repeat.set(...repeat);
    mat.alphaMap.needsUpdate = true;
    mat.alphaTest = 0.25 + 0.65 * k;
    mat.color = new THREE.Color(mat.color).multiplyScalar(0.85 + 0.25 * k);
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>",
        `#include <begin_vertex>\n transformed += normalize(objectNormal) * ${(length * k).toFixed(4)};`);
    };
    mat.customProgramCacheKey = () => "shell" + i;
    const s = new THREE.Mesh(mesh.geometry, mat);
    s.castShadow = false;
    s.receiveShadow = true;
    mesh.add(s);
    shells.push(s);
  }
  return shells;
}

const joint = (parent, pos = [0, 0, 0], order = "XYZ") => {
  const j = new THREE.Group();
  j.position.set(...pos);
  j.rotation.order = order;
  parent.add(j);
  return j;
};
const mesh = (geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export function createTiger({ shells = 8 } = {}) {
  const noise = furNoise(77);
  const furMat = (map) => new THREE.MeshPhysicalMaterial({ color: "#ffffff", map, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffd9a8") });
  const M = {
    body: furMat(bodyTex(5)), head: furMat(headTex(6)), front: furMat(limbTex(7)), hind: furMat(limbTex(8, { creamFrom: 0.75 })),
    tail: furMat(limbTex(9, { creamFrom: 0.92, bands: 7 })), cream: furMat(null), dark: new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.9 }),
    pad: new THREE.MeshStandardMaterial({ color: "#5b3a32", roughness: 0.7 }), nose: new THREE.MeshPhysicalMaterial({ color: "#d98a86", roughness: 0.35, clearcoat: 0.5 }),
    eye: new THREE.MeshPhysicalMaterial({ color: "#f2b632", roughness: 0.2, clearcoat: 1 }), pupil: MAT.pupil(), glint: MAT.glint(),
    mouth: MAT.mouth(), fang: MAT.teeth(), tongue: MAT.tongue(), claw: new THREE.MeshStandardMaterial({ color: "#efe6d8", roughness: 0.4 }),
    whisker: new THREE.MeshBasicMaterial({ color: "#f6f1e8" }),
  };
  M.cream.color.set(CREAM);

  const root = new THREE.Group();
  const J = {};
  J.torso = joint(root, [0, 0.55, 0], "YXZ");
  J.hips = joint(J.torso, [0, 0, -0.42]);
  J.spine1 = joint(J.hips, [0, 0.01, 0.28]);
  J.spine2 = joint(J.spine1, [0, 0.01, 0.28]);
  J.chest = joint(J.spine2, [0, 0, 0.28]);

  // ---- body tube, rebuilt each frame along the spine joints ----
  const RINGS = 30, SEGS = 32;
  const bodyGeo = new THREE.BufferGeometry();
  const pos = new Float32Array((RINGS + 1) * (SEGS + 1) * 3), uv = new Float32Array((RINGS + 1) * (SEGS + 1) * 2), idx = [];
  for (let i = 0; i <= RINGS; i++) for (let j = 0; j <= SEGS; j++) {
    const n = i * (SEGS + 1) + j;
    uv[n * 2] = i / RINGS;
    uv[n * 2 + 1] = j / SEGS;
    if (i < RINGS && j < SEGS) {
      const a = n, b = n + SEGS + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  bodyGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  bodyGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  bodyGeo.setIndex(idx);
  const radius = (u) => {
    // rump cap -> haunch -> waist -> ribcage -> neck
    const pts = [[0, 0.02], [0.04, 0.13], [0.12, 0.19], [0.3, 0.19], [0.5, 0.165], [0.72, 0.2], [0.86, 0.21], [1, 0.15]];
    for (let k = 1; k < pts.length; k++) if (u <= pts[k][0]) {
      const [u0, r0] = pts[k - 1], [u1, r1] = pts[k], s = (u - u0) / (u1 - u0);
      return r0 + (r1 - r0) * (s * s * (3 - 2 * s));
    }
    return 0.15;
  };
  const body = mesh(bodyGeo, M.body);
  J.torso.add(body);
  const bodyShells = shells > 0 ? addShells(body, shells, 0.022, noise, [40, 20]) : [];

  const tmpV = new THREE.Vector3(), curvePts = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3();
  function rebuildBody() {
    J.torso.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(J.torso.matrixWorld).invert();
    const at = (obj, off) => tmpV.set(...off).applyMatrix4(obj.matrixWorld).applyMatrix4(inv).clone();
    curvePts[0].copy(at(J.hips, [0, 0.02, -0.16]));
    curvePts[1].copy(at(J.hips, [0, 0, 0]));
    curvePts[2].copy(at(J.spine1, [0, 0, 0]));
    curvePts[3].copy(at(J.spine2, [0, 0, 0]));
    curvePts[4].copy(at(J.chest, [0, 0, 0]));
    curvePts[5].copy(at(J.chest, [0, 0.06, 0.18]));
    for (let i = 0; i <= RINGS; i++) {
      const u = i / RINGS;
      curve.getPoint(u, P);
      curve.getTangent(u, T);
      S.crossVectors(T, up).normalize();
      N.crossVectors(S, T).normalize();
      const r = radius(u), belly = u > 0.55 && u < 0.92 ? 0.03 * Math.sin(((u - 0.55) / 0.37) * Math.PI) : 0;
      for (let j = 0; j <= SEGS; j++) {
        const th = (j / SEGS) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        const ry = r * 1.18 + (c < 0 ? belly : 0); // deeper than wide; belly hangs a little
        const n = (i * (SEGS + 1) + j) * 3;
        pos[n] = P.x + S.x * r * sn + N.x * ry * c;
        pos[n + 1] = P.y + S.y * r * sn + N.y * ry * c;
        pos[n + 2] = P.z + S.z * r * sn + N.z * ry * c;
      }
    }
    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.computeVertexNormals();
    bodyGeo.computeBoundingSphere();
  }

  // ---- head ----
  J.neck = joint(J.chest, [0, 0.11, 0.18], "YXZ");
  J.neck.add(mesh(new THREE.SphereGeometry(0.16, 24, 16), M.body, { pos: [0, 0.02, 0.04], scale: [1, 1.05, 1.2] }));
  J.head = joint(J.neck, [0, 0.13, 0.19], "YXZ");
  J.head.scale.setScalar(1.25);
  const skull = mesh(new THREE.SphereGeometry(0.19, 40, 28), M.head, { scale: [1.1, 0.95, 1] });
  J.head.add(skull);
  const headShells = shells > 0 ? addShells(skull, Math.max(2, Math.round(shells / 2)), 0.014, noise, [30, 15]) : [];
  // cheek ruff tufts
  for (const sd of [1, -1]) for (let k = 0; k < 3; k++) {
    J.head.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), M.cream, { pos: [sd * (0.15 + k * 0.015), -0.07 - k * 0.035, 0.02 - k * 0.03], rot: [0, 0, sd * (0.5 + k * 0.25)], scale: [1.3, 0.55, 0.8] }));
  }
  // muzzle, nose
  J.head.add(mesh(new THREE.SphereGeometry(0.105, 28, 20), M.cream, { pos: [0, -0.06, 0.15], scale: [1.15, 0.78, 1] }));
  J.head.add(mesh(new THREE.SphereGeometry(0.05, 20, 14), M.head, { pos: [0, 0.0, 0.18], scale: [0.9, 0.7, 1.2] })); // nose bridge
  J.head.add(mesh(new THREE.SphereGeometry(0.035, 20, 14), M.nose, { pos: [0, -0.02, 0.245], scale: [1.3, 0.75, 0.8] }));
  // whiskers
  for (const sd of [1, -1]) for (let k = 0; k < 4; k++) {
    const w = mesh(new THREE.CylinderGeometry(0.0018, 0.0012, 0.26, 4), M.whisker, { pos: [sd * 0.15, -0.07 - k * 0.012, 0.19], rot: [0, 0, sd * (Math.PI / 2 - 0.15 + k * 0.1)] });
    w.castShadow = false;
    J.head.add(w);
  }
  // ears: outer orange, dark back, white center spot
  for (const sd of [1, -1]) {
    const ear = joint(J.head, [sd * 0.12, 0.15, -0.03]);
    ear.rotation.set(-0.2, 0, sd * -0.35);
    ear.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), M.dark, { scale: [1, 1, 0.45] }));
    ear.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), M.cream, { pos: [0, -0.005, 0.018], scale: [0.9, 0.9, 0.3] }));
    (J.ears ??= []).push(ear);
  }
  // eyes + angry brows
  J.eyes = [];
  J.brows = [];
  for (const sd of [1, -1]) {
    const socket = joint(J.head, [sd * 0.075, 0.03, 0.16]);
    socket.add(mesh(new THREE.SphereGeometry(0.034, 20, 14), M.eye, { scale: [1, 0.85, 0.7] }));
    const ball = joint(socket, [0, 0, 0], "YXZ");
    ball.add(mesh(new THREE.SphereGeometry(0.015, 14, 10), M.pupil, { pos: [0, 0, 0.022], scale: [0.8, 1.2, 0.4] }));
    ball.add(mesh(new THREE.SphereGeometry(0.005, 8, 6), M.glint, { pos: [0.006, 0.008, 0.027] }));
    J.eyes.push(ball);
    const brow = joint(J.head, [sd * 0.075, 0.075, 0.165]);
    brow.add(mesh(new THREE.CapsuleGeometry(0.011, 0.05, 4, 8), M.dark, { rot: [0, 0, Math.PI / 2] }));
    J.brows.push(brow);
  }
  // jaw (hinged): lower jaw, mouth interior, fangs, tongue
  J.jaw = joint(J.head, [0, -0.08, 0.05]);
  J.jaw.add(mesh(new THREE.SphereGeometry(0.09, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.cream, { pos: [0, 0.0, 0.1], scale: [1.05, 0.7, 1.15] }));
  J.jaw.add(mesh(new THREE.SphereGeometry(0.075, 20, 14), M.mouth, { pos: [0, 0.01, 0.1], scale: [1, 0.35, 1.05] }));
  J.jaw.add(mesh(new THREE.SphereGeometry(0.035, 14, 10), M.tongue, { pos: [0, 0.012, 0.13], scale: [1.2, 0.35, 1.3] }));
  for (const sd of [1, -1]) J.jaw.add(mesh(new THREE.ConeGeometry(0.012, 0.045, 10), M.fang, { pos: [sd * 0.05, 0.03, 0.17] }));
  J.upperMouth = mesh(new THREE.SphereGeometry(0.07, 20, 14), M.mouth, { pos: [0, -0.085, 0.16], scale: [1.05, 0.3, 1] });
  J.head.add(J.upperMouth);
  for (const sd of [1, -1]) J.head.add(mesh(new THREE.ConeGeometry(0.014, 0.06, 10), M.fang, { pos: [sd * 0.05, -0.1, 0.2], rot: [Math.PI, 0, 0] }));

  // ---- legs ----
  const legDefs = { FL: [J.chest, 0.14, -0.1, QUAD.front, M.front, 0.092], FR: [J.chest, -0.14, -0.1, QUAD.front, M.front, 0.092],
    HL: [J.hips, 0.13, -0.07, QUAD.hind, M.hind, 0.105], HR: [J.hips, -0.13, -0.07, QUAD.hind, M.hind, 0.105] };
  for (const [name, [parent, x, y, [l1, l2], mat, r]] of Object.entries(legDefs)) {
    const top = joint(parent, [x, y, 0]);
    const hind = name[0] === "H";
    // shoulder blade / haunch mass: elongated along the leg, blends into the body
    top.add(mesh(new THREE.SphereGeometry(r * (hind ? 1.45 : 1.25), 20, 14), mat, { pos: [0, -0.04, hind ? -0.01 : 0.01], scale: [0.75, 1.5, hind ? 1.25 : 1.0] }));
    top.add(mesh(new THREE.CapsuleGeometry(r, l1 - r, 6, 16), mat, { pos: [0, -l1 / 2, 0] }));
    const mid = joint(top, [0, -l1, 0]);
    mid.add(mesh(new THREE.CapsuleGeometry(r * 0.72, l2 - r * 0.7, 6, 14), mat, { pos: [0, -l2 / 2, 0] }));
    const paw = joint(mid, [0, -l2, 0]);
    paw.add(mesh(new THREE.SphereGeometry(r * 1.05, 20, 14), M.cream, { pos: [0, -0.02, 0.03], scale: [1.1, 0.6, 1.35] }));
    for (let k = -1.5; k <= 1.5; k++) {
      paw.add(mesh(new THREE.SphereGeometry(r * 0.32, 10, 8), M.cream, { pos: [k * r * 0.5, -0.03, 0.03 + r * 1.1], scale: [1, 0.8, 1] }));
      paw.add(mesh(new THREE.SphereGeometry(r * 0.17, 8, 6), M.pad, { pos: [k * r * 0.5, -0.05, 0.03 + r * 1.05], scale: [1, 0.5, 1] }));
      paw.add(mesh(new THREE.ConeGeometry(r * 0.06, r * 0.25, 6), M.claw, { pos: [k * r * 0.5, -0.035, 0.03 + r * 1.42], rot: [Math.PI / 2, 0, 0] }));
    }
    paw.add(mesh(new THREE.SphereGeometry(r * 0.45, 12, 8), M.pad, { pos: [0, -0.05, 0.02], scale: [1.2, 0.4, 1] }));
    J[name] = { top, mid, paw };
  }

  // ---- tail chain ----
  J.tail = [];
  let parent = joint(J.hips, [0, 0.08, -0.16]);
  parent.rotation.x = Math.PI; // chain points backward (-z): local +z of each segment = toward the tip
  for (let k = 0; k < 6; k++) {
    const seg = joint(parent, k === 0 ? [0, 0, 0] : [0, 0, 0.12]);
    const r = 0.045 - k * 0.004;
    const m = mesh(new THREE.CapsuleGeometry(r, 0.1, 4, 12), k === 5 ? M.cream : M.tail, { pos: [0, 0, 0.06], rot: [Math.PI / 2, 0, 0] });
    seg.add(m);
    J.tail.push(seg);
    parent = seg;
  }
  J.tail[5].add(mesh(new THREE.SphereGeometry(0.05, 14, 10), M.cream, { pos: [0, 0, 0.13], scale: [1, 1, 1.3] }));

  root.traverse((o) => { if (o.isMesh && o.material !== M.whisker) o.castShadow = true; });

  function setPose(p) {
    J.torso.position.y = 0.55 + p.body.y;
    J.torso.rotation.x = -p.body.pitch;
    J.spine1.rotation.x = p.spine[0];
    J.spine2.rotation.x = p.spine[1];
    J.chest.rotation.x = p.spine[2];
    J.neck.rotation.set(-0.15 + p.head.pitch * 0.5, p.head.rotY * 0.5, 0);
    J.head.rotation.set(0.15 + p.head.pitch * 0.5, p.head.rotY * 0.5, p.head.roll ?? 0);
    for (const n of ["FL", "FR", "HL", "HR"]) {
      J[n].top.rotation.x = -p[n].upper - (n[0] === "F" ? p.spine[2] + p.spine[1] + p.spine[0] : 0);
      J[n].mid.rotation.x = -p[n].lower;
      J[n].paw.rotation.x = -p[n].paw;
    }
    p.tail.forEach((a, k) => (J.tail[k].rotation.x = a));
    rebuildBody();
  }

  function setFace(f) {
    J.jaw.rotation.x = 0.75 * f.jaw;
    J.brows.forEach((b, i) => { b.rotation.z = (i === 0 ? 1 : -1) * (0.35 * f.brow); b.position.y = 0.075 - 0.01 * f.brow; });
    J.eyes.forEach((e) => e.rotation.set(-f.eyeY * 0.4, f.eyeX * 0.5, 0));
    J.ears.forEach((e, i) => (e.rotation.z = (i === 0 ? -1 : 1) * (0.35 + 0.35 * f.brow)));
  }

  function update(t) {
    // secondary: tail sway layered on the pose, ear flick
    J.tail.forEach((s, k) => (s.rotation.y = 0.12 * Math.sin(t * 5 - k * 0.6)));
  }

  return { root, joints: J, setPose, setFace, update, shellCount: bodyShells.length + headShells.length };
}
