// Hillside terrain with a carved dirt trail. heightAt() is analytic so feet/IK can query it exactly.
import * as THREE from "three";
import { mulberry32, hash } from "./rng.js";

// trail control points (x, z); the trail runs downhill toward +z (toward the S2 camera)
const PATH_XZ = [[-3.2, -22], [-2.6, -14], [-1.4, -8], [0, -3], [1.0, 1.5], [1.8, 6], [2.8, 12], [3.6, 18]];

function valueNoise2(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const h = (a, b) => hash(a * 7919 + b * 104729, seed) * 2 - 1;
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z, seed) => valueNoise2(x, z, seed) * 0.6 + valueNoise2(x * 2.1, z * 2.1, seed + 1) * 0.28 + valueNoise2(x * 4.3, z * 4.3, seed + 2) * 0.12;

// trail centre x for a given z (monotonic in z), via Catmull-Rom on the control points
const pathCurve2 = new THREE.SplineCurve(PATH_XZ.map(([x, z]) => new THREE.Vector2(x, z)));
const PX = [];
for (let i = 0; i <= 800; i++) PX.push(pathCurve2.getPoint(i / 800));
function pathXAt(z) {
  if (z <= PX[0].y) return PX[0].x;
  for (let i = 1; i < PX.length; i++) if (z <= PX[i].y) {
    const a = PX[i - 1], b = PX[i], k = (z - a.y) / (b.y - a.y);
    return a.x + (b.x - a.x) * k;
  }
  return PX[PX.length - 1].x;
}

export function heightAt(x, z) {
  const d = x - pathXAt(z); // <0 uphill side (left), >0 valley side (right)
  let h = -0.07 * z;
  if (d < -1.0) h += 0.42 * (-d - 1.0) + 0.04 * (-d - 1.0) ** 2;
  if (d > 1.4) h -= 0.45 * Math.pow(d - 1.4, 1.25);
  const band = Math.min(1, Math.max(0, (Math.abs(d) - 0.7) / 0.8));
  h += fbm(x * 0.35, z * 0.35, 5) * (0.04 + 0.35 * band);
  return h;
}

export const trailOffset = (x, z) => x - pathXAt(z);

function dirtTex() {
  const rnd = mulberry32(21);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#cfcfcf";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    const v = 150 + rnd() * 105;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 512, 0.5 + rnd() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 300; i++) { // pine needles
    const v = 90 + rnd() * 60;
    g.strokeStyle = `rgba(${v},${v * 0.8},${v * 0.6},0.6)`;
    g.lineWidth = 1;
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  t.anisotropy = 8;
  return t;
}

export function createTerrain(scene) {
  const SIZE = 64, SEGS = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);
  geo.translate(4, 0, 0);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const dirt = new THREE.Color("#c99063"), dirtDark = new THREE.Color("#a8703f"), grass = new THREE.Color("#7d7a3c"),
    needles = new THREE.Color("#8a5f36"), moss = new THREE.Color("#5f6b2f"), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const d = Math.abs(trailOffset(x, z));
    const n = fbm(x * 0.8, z * 0.8, 9) * 0.5 + 0.5;
    const ground = c.copy(grass).lerp(needles, n).lerp(moss, Math.max(0, fbm(x * 0.3, z * 0.3, 3)) * 0.6);
    const trail = dirt.clone().lerp(dirtDark, fbm(x * 1.5, z * 1.5, 4) * 0.5 + 0.3);
    const k = Math.min(1, Math.max(0, (d - 0.75) / 0.45));
    const out = trail.lerp(ground, k);
    col[i * 3] = out.r; col[i * 3 + 1] = out.g; col[i * 3 + 2] = out.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: dirtTex(), roughness: 1 }));
  mesh.receiveShadow = true;
  scene.add(mesh);

  const path3 = (u) => {
    const z = PATH_XZ[0][1] + (PATH_XZ[PATH_XZ.length - 1][1] - PATH_XZ[0][1]) * u;
    const x = pathXAt(z);
    return new THREE.Vector3(x, heightAt(x, z), z);
  };
  return { mesh, heightAt, trailOffset, pathXAt, pathPoint: path3 };
}
