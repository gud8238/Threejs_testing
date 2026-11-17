// Korean red pines, mossy rocks, berry bushes, grass tufts — all instanced where possible.
import * as THREE from "three";
import { mulberry32 } from "./rng.js";

function barkTex() {
  const rnd = mulberry32(31);
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#8a4a2b";
  g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 260; i++) { // plated bark
    const v = rnd();
    g.fillStyle = v < 0.5 ? `rgba(60,30,18,${0.3 + rnd() * 0.4})` : `rgba(190,110,70,${0.2 + rnd() * 0.3})`;
    const x = rnd() * 128, y = rnd() * 512;
    g.fillRect(x, y, 6 + rnd() * 18, 3 + rnd() * 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

function leafTex() {
  const rnd = mulberry32(32);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#c9c9c9";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { // needle tufts
    const v = 120 + rnd() * 135;
    g.strokeStyle = `rgba(${v},${v},${v},0.7)`;
    const x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rockGeo(seed) {
  const rnd = mulberry32(seed);
  const g = new THREE.SphereGeometry(1, 28, 18);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const stone = new THREE.Color("#8f8a80"), moss = new THREE.Color("#6f7a33"), c = new THREE.Color();
  const bumps = Array.from({ length: 8 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 0.25]);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    let r = 1;
    for (const [x, y, z, a] of bumps) r += a * Math.max(0, v.dot(new THREE.Vector3(x, y, z).normalize()));
    r += 0.04 * Math.sin(v.x * 9 + seed) * Math.cos(v.z * 8) * Math.sin(v.y * 7);
    v.multiplyScalar(r);
    v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
    const top = Math.max(0, v.y / 0.62) ** 1.5;
    c.copy(stone).lerp(new THREE.Color("#b8b2a6"), 0.5 + 0.5 * Math.sin(v.x * 13 + v.z * 11)).lerp(moss, top * 0.75);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function createFlora(scene, terrain) {
  const rnd = mulberry32(99);
  const bark = new THREE.MeshStandardMaterial({ color: "#ffffff", map: barkTex(), roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: "#7b9a45", map: leafTex(), roughness: 0.85 });
  const pads = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- pines: curved trunk tube + branches + horizontal foliage pads ----
  const pine = (x, z, height, lean, seed) => {
    const r = mulberry32(seed);
    const y0 = terrain.heightAt(x, z) - 0.2;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      pts.push(new THREE.Vector3(x + lean[0] * t * height + Math.sin(t * 3 + seed) * 0.25 * t, y0 + t * height, z + lean[1] * t * height));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const trunkR = 0.12 + height * 0.02;
    const geo = new THREE.TubeGeometry(curve, 24, trunkR, 10, false);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { // taper toward the top
      const k = Math.floor(i / 11) / 24, c = curve.getPoint(k);
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(c).multiplyScalar(1 - 0.6 * k).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const trunk = new THREE.Mesh(geo, bark);
    trunk.castShadow = trunk.receiveShadow = true;
    group.add(trunk);
    const nb = 4 + Math.floor(r() * 3);
    for (let b = 0; b < nb; b++) {
      const t = 0.45 + (b / nb) * 0.55;
      const base = curve.getPoint(t);
      const ang = r() * Math.PI * 2, len = (1 - t * 0.5) * height * (0.25 + r() * 0.15);
      const end = base.clone().add(new THREE.Vector3(Math.cos(ang) * len, len * 0.25, Math.sin(ang) * len));
      const bc = new THREE.QuadraticBezierCurve3(base, base.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -0.1, 0)), end);
      const br = new THREE.Mesh(new THREE.TubeGeometry(bc, 8, trunkR * 0.35, 6), bark);
      br.castShadow = true;
      group.add(br);
      pads.push([end.x, end.y, end.z, len * (0.65 + r() * 0.3)]);
      pads.push([end.x + (r() - 0.5) * 0.5, end.y + 0.15, end.z + (r() - 0.5) * 0.5, len * 0.45]);
    }
    const top = curve.getPoint(1);
    pads.push([top.x, top.y + 0.1, top.z, height * 0.22]);
  };

  // uphill side (left of trail) and a few on the valley side, like the painting
  const trees = [[-3.6, 2], [-2.6, -3], [-4.4, -7], [-3.3, -11], [-5.5, -1], [-4.8, 6], [-6.5, -14], [3.6, -4], [5.2, 3.5], [4.4, -12], [7.5, -2]];
  trees.forEach(([dx, z], i) => {
    const x = terrain.pathXAt(z) + dx;
    pine(x, z, 4.5 + rnd() * 3, [(rnd() - 0.5) * 0.25 + (dx > 0 ? 0.12 : -0.05), (rnd() - 0.5) * 0.2], 200 + i);
  });

  // foliage pads: flattened lumpy spheres, instanced
  const padGeo = new THREE.IcosahedronGeometry(1, 2);
  const pp = padGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const v = new THREE.Vector3(pp.getX(i), pp.getY(i), pp.getZ(i));
    v.multiplyScalar(1 + 0.12 * Math.sin(v.x * 7) * Math.cos(v.z * 6));
    pp.setXYZ(i, v.x, v.y * (v.y > 0 ? 0.42 : 0.22), v.z);
  }
  padGeo.computeVertexNormals();
  const padMesh = new THREE.InstancedMesh(padGeo, leafMat, pads.length * 5);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), tpos = new THREE.Vector3();
  let k = 0;
  for (const [x, y, z, r] of pads) for (let j = 0; j < 5; j++) {
    tpos.set(x + (rnd() - 0.5) * r * 0.7, y + (rnd() - 0.3) * r * 0.25, z + (rnd() - 0.5) * r * 0.7);
    q.setFromEuler(new THREE.Euler(0, rnd() * 6.28, (rnd() - 0.5) * 0.15));
    s.setScalar(r * (0.42 + rnd() * 0.3));
    padMesh.setMatrixAt(k++, m.compose(tpos, q, s));
  }
  padMesh.castShadow = padMesh.receiveShadow = true;
  group.add(padMesh);

  // ---- rocks along the trail edges ----
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const rocks = [];
  for (let i = 0; i < 46; i++) {
    const z = -18 + rnd() * 30, side = rnd() < 0.6 ? -1 : 1;
    const dx = side * (1.0 + rnd() * (side < 0 ? 3.2 : 1.6));
    const big = rnd() < 0.18;
    rocks.push([terrain.pathXAt(z) + dx, z, big ? 0.55 + rnd() * 0.6 : 0.12 + rnd() * 0.25]);
  }
  rocks.push([1.6, 7.2, 0.9], [-1.7, 4.5, 0.75], [-1.3, -1.5, 0.6]); // hero rocks near camera paths
  // keep the S3 camera's line of sight clear (camera sits low beside the trail at z = -3.1)
  const camX = terrain.pathXAt(-3.1) - 1.45;
  // ...and the S4 orbit camera's corridor on the uphill side of the trail
  const inS4Corridor = (x, z) => z > -3.8 && z < 3.8 && x - terrain.pathXAt(z) < -0.8 && x - terrain.pathXAt(z) > -4.2;
  for (let i = rocks.length - 1; i >= 0; i--) {
    const [x, z] = rocks[i];
    if ((z < -2.4 && z > -9 && Math.abs(x - camX) < 1.6) || inS4Corridor(x, z)) rocks.splice(i, 1);
  }
  const rockGeos = [rockGeo(1), rockGeo(2), rockGeo(3)];
  rockGeos.forEach((g, gi) => {
    const mine = rocks.filter((_, i) => i % 3 === gi);
    const im = new THREE.InstancedMesh(g, rockMat, mine.length);
    mine.forEach(([x, z, r], j) => {
      tpos.set(x, terrain.heightAt(x, z) + r * 0.15, z);
      q.setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0));
      s.set(r * (1 + rnd() * 0.4), r, r * (1 + rnd() * 0.3));
      im.setMatrixAt(j, m.compose(tpos, q, s));
    });
    im.castShadow = im.receiveShadow = true;
    group.add(im);
  });

  // ---- berry bushes (leaves + red berries), incl. the S3 foreground bush ----
  const bushes = [[-2.2, 3.0, 0.8], [-1.6, 5.5, 1.1], [-2.0, -2.0, 0.7], [2.0, 1.0, 0.6], [-2.6, 8.5, 1.2], [1.7, -6, 0.6],
    [-1.9, -7.9, 0.85], [-1.75, -4.4, 0.5]]; // last two: the tiger's hiding bush and the S3 foreground bush
  const leafGeo = new THREE.SphereGeometry(1, 8, 6);
  leafGeo.scale(1, 0.25, 0.55);
  const bLeaf = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: "#7c9a35", roughness: 0.7 }), bushes.length * 120);
  const berry = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({ color: "#c0261c", roughness: 0.25, clearcoat: 0.8 }), bushes.length * 60);
  let li = 0, bi = 0;
  for (const [dx, z, r] of bushes) {
    const x = terrain.pathXAt(z) + dx, y0 = terrain.heightAt(x, z);
    if (inS4Corridor(x, z) && z > -3.5) continue; // keep the S3 foreground bush (z = -4.4)
    for (let j = 0; j < 120; j++) {
      const a = rnd() * 6.28, h = rnd(), rr = r * Math.sqrt(1 - h * h) * (0.6 + rnd() * 0.4);
      tpos.set(x + Math.cos(a) * rr, y0 + h * r * 1.1, z + Math.sin(a) * rr);
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.2, a, (rnd() - 0.5) * 1.2));
      s.setScalar(0.06 + rnd() * 0.035);
      bLeaf.setMatrixAt(li++, m.compose(tpos, q, s));
    }
    for (let j = 0; j < 60; j++) {
      const a = rnd() * 6.28, h = 0.3 + rnd() * 0.6, rr = r * Math.sqrt(1 - h * h) * 1.02;
      tpos.set(x + Math.cos(a) * rr, y0 + h * r * 1.1, z + Math.sin(a) * rr);
      s.setScalar(0.016 + rnd() * 0.008);
      berry.setMatrixAt(bi++, m.compose(tpos, q.identity(), s));
    }
  }
  bLeaf.count = li; // skipped bushes leave unused slots: draw only what was placed
  berry.count = bi;
  bLeaf.castShadow = true;
  group.add(bLeaf, berry);

  // ---- grass tufts along the trail edges ----
  const blade = new THREE.ConeGeometry(0.01, 0.17, 3);
  blade.translate(0, 0.085, 0);
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: "#b5a958", roughness: 0.9 }), 3000);
  for (let j = 0; j < 3000; j++) {
    const z = -18 + rnd() * 32, side = rnd() < 0.5 ? -1 : 1, dx = side * (0.8 + rnd() * 2.2);
    const x = terrain.pathXAt(z) + dx;
    tpos.set(x, terrain.heightAt(x, z), z);
    q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.6, rnd() * 6.28, (rnd() - 0.5) * 0.6));
    s.set(1, 0.6 + rnd() * 0.9, 1);
    grass.setMatrixAt(j, m.compose(tpos, q, s));
  }
  group.add(grass);
  return { group };
}
