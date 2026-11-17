// Shared procedural textures and materials (no image files: everything is drawn on canvases, seeded).
import * as THREE from "three";
import { mulberry32 } from "./rng.js";

function canvasTex(w, h, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

// linen weave: fine crossing threads + slubs, grey-scale (multiplied by material color)
export function weaveTex(seed = 1, repeat = [4, 4]) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#d8d8d8";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 2) {
      const v = 190 + rnd() * 60;
      g.fillStyle = `rgba(${v},${v},${v},0.55)`;
      g.fillRect(i, 0, 1, h);
      g.fillRect(0, i, w, 1);
    }
    for (let i = 0; i < 260; i++) {
      const v = 150 + rnd() * 105;
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      if (rnd() < 0.5) g.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 18, 1);
      else g.fillRect(rnd() * w, rnd() * h, 1, 6 + rnd() * 18);
    }
  }, { repeat });
}

// straw weave (shoes, basket): diagonal over-under strands
export function strawTex(seed = 2, repeat = [3, 3]) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#b98a45";
    g.fillRect(0, 0, w, h);
    const cell = 16;
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const over = ((x + y) / cell) % 2 === 0;
      const grd = over ? g.createLinearGradient(x, y, x + cell, y) : g.createLinearGradient(x, y, x, y + cell);
      const l = 0.9 + rnd() * 0.2;
      grd.addColorStop(0, `rgb(${150 * l},${105 * l},${50 * l})`);
      grd.addColorStop(0.5, `rgb(${235 * l},${190 * l},${115 * l})`);
      grd.addColorStop(1, `rgb(${150 * l},${105 * l},${50 * l})`);
      g.fillStyle = grd;
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }, { repeat });
}

// hair strands: fine light/dark streaks along v
export function hairTex(seed = 3) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#a9a6a3";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 120 + rnd() * 130, x = rnd() * w;
      g.strokeStyle = `rgba(${v},${v - 4},${v - 8},0.5)`;
      g.lineWidth = 0.6 + rnd();
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + rnd() * 8 - 4, h * 0.3, x + rnd() * 8 - 4, h * 0.7, x + rnd() * 6 - 3, h);
      g.stroke();
    }
  });
}

// soft speckle used as roughness/bump variation on skin
export function skinTex(seed = 4) {
  const rnd = mulberry32(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#e9e9e9";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const v = 200 + rnd() * 55;
      g.fillStyle = `rgba(${v},${v * 0.96},${v * 0.94},0.4)`;
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 0.5 + rnd() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function fabric(color, seed, repeat = [4, 4]) {
  const t = weaveTex(seed, repeat);
  return new THREE.MeshPhysicalMaterial({
    color, map: t, roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35),
    bumpMap: t, bumpScale: 0.25,
  });
}

export const MAT = {
  skin: () => new THREE.MeshPhysicalMaterial({ color: "#e8b48f", map: skinTex(), roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color("#ffd2b8"), clearcoat: 0.05 }),
  blush: () => new THREE.MeshBasicMaterial({ color: "#e98a7a", transparent: true, opacity: 0.35, depthWrite: false }),
  hair: () => new THREE.MeshStandardMaterial({ color: "#c9c5c0", map: hairTex(), roughness: 0.6 }),
  eyeWhite: () => new THREE.MeshPhysicalMaterial({ color: "#f8f5ef", roughness: 0.15, clearcoat: 1 }),
  iris: (c = "#5a3a22") => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 }),
  pupil: () => new THREE.MeshBasicMaterial({ color: "#0d0806" }),
  glint: () => new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  mouth: () => new THREE.MeshStandardMaterial({ color: "#5a1c1c", roughness: 0.8 }),
  teeth: () => new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.4 }),
  tongue: () => new THREE.MeshStandardMaterial({ color: "#c2585a", roughness: 0.6 }),
  straw: () => new THREE.MeshStandardMaterial({ color: "#ffffff", map: strawTex(), roughness: 0.85 }),
  wood: () => new THREE.MeshStandardMaterial({ color: "#7a4a26", roughness: 0.6 }),
};
