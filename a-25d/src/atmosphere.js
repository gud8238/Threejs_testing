// Atmosphere: drifting fog cards, warm light shafts, dust motes. Everything is f(t).
import * as THREE from "three";
import { mulberry32, hash } from "./rng.js";

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fogTexture(seed) {
  const rnd = mulberry32(seed);
  return canvasTex(512, 256, (g, w, h) => {
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = h * (0.35 + rnd() * 0.4), r = 30 + rnd() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,244,236,0.20)");
      grd.addColorStop(1, "rgba(255,244,236,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
  });
}

function edgeMask() {
  // soft-edged alpha mask so fog cards never show a rectangle
  return canvasTex(256, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x) / (w * 0.3), ey = Math.min(y, h - 1 - y) / (h * 0.45);
      const a = Math.min(1, ex) * Math.min(1, ey);
      const v = Math.round(255 * a * a * (3 - 2 * a));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

function rayTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const rnd = mulberry32(11);
    for (let i = 0; i < 7; i++) {
      const x = w * (0.1 + rnd() * 0.8), wd = 20 + rnd() * 60;
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, `rgba(255,214,150,${0.10 + rnd() * 0.12})`);
      grd.addColorStop(1, "rgba(255,214,150,0)");
      g.fillStyle = grd;
      g.save();
      g.translate(x, 0);
      g.rotate(-0.42);
      g.fillRect(-wd / 2, -40, wd, h * 1.3);
      g.restore();
    }
  });
}

function dotTexture() {
  return canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,240,210,1)");
    grd.addColorStop(0.4, "rgba(255,230,190,0.5)");
    grd.addColorStop(1, "rgba(255,230,190,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

export function createAtmosphere(scene, bg) {
  const fogs = [];
  const mask = edgeMask();
  // fog bands across the far valley (right side of the painting)
  [[1150, 330, 16, 1], [1250, 430, 13, 2]].forEach(([x, y, w, seed], k) => {
    const tex = fogTexture(seed);
    tex.wrapS = THREE.RepeatWrapping;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.32),
      new THREE.MeshBasicMaterial({ map: tex, alphaMap: mask, transparent: true, depthWrite: false, depthTest: false,
        opacity: 0.55 }),
    );
    m.position.copy(bg.worldAt(x, y));
    m.renderOrder = 1 + k;
    scene.add(m);
    fogs.push({ m, tex, speed: 0.006 + k * 0.004 });
  });

  // warm light shafts from the upper left, in front of the trees
  const rays = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: rayTexture(), transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, opacity: 0.55 }),
  );
  rays.position.copy(bg.worldAt(520, 230)).multiplyScalar(0.85);
  rays.renderOrder = 18;
  scene.add(rays);

  // dust motes in the light
  const N = 260;
  const base = new Float32Array(N * 3);
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const z = -(4 + hash(i, 1) * 9);
    const half = Math.tan(THREE.MathUtils.degToRad(24)) * -z;
    base[i * 3] = (hash(i, 2) * 2 - 1) * half * 1.8;
    base[i * 3 + 1] = (hash(i, 3) * 2 - 1) * half;
    base[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({
    map: dotTexture(), size: 0.06, sizeAttenuation: true, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, opacity: 0.7, color: 0xffd9a0 }));
  dust.renderOrder = 19;
  scene.add(dust);

  return {
    update(t) {
      for (const f of fogs) f.tex.offset.x = t * f.speed;
      rays.material.opacity = 0.45 + 0.12 * Math.sin(t * 0.9);
      for (let i = 0; i < N; i++) {
        const ph = hash(i, 4) * 6.283;
        pos[i * 3] = base[i * 3] + t * (0.05 + hash(i, 5) * 0.1) + Math.sin(t * 0.7 + ph) * 0.08;
        pos[i * 3 + 1] = base[i * 3 + 1] - t * 0.03 + Math.sin(t * 1.1 + ph) * 0.06;
        pos[i * 3 + 2] = base[i * 3 + 2];
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
