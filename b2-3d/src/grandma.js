// Grandma, built from primitives with an Object3D joint hierarchy. Faces +z, height ~1.05 units.
import * as THREE from "three";
import { BIPED } from "./anim/gait.js";
import { MAT, fabric } from "./mats.js";

const SEG = 32;
const mesh = (geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], shadow = true } = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
const joint = (parent, pos = [0, 0, 0], order = "XYZ") => {
  const j = new THREE.Group();
  j.position.set(...pos);
  j.rotation.order = order;
  parent.add(j);
  return j;
};
const sphere = (r, ws = SEG, hs = 24) => new THREE.SphereGeometry(r, ws, hs);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);

export function createGrandma() {
  const M = {
    skin: MAT.skin(), hair: MAT.hair(), white: fabric("#efe3cf", 11, [3, 3]),
    top: fabric("#b05c52", 12, [4, 4]), skirt: fabric("#7d4a5a", 13, [3, 2]), ribbon: fabric("#6e3b58", 14, [2, 2]),
    straw: MAT.straw(), wood: MAT.wood(), eyeWhite: MAT.eyeWhite(), iris: MAT.iris(), pupil: MAT.pupil(),
    glint: MAT.glint(), mouth: MAT.mouth(), teeth: MAT.teeth(), tongue: MAT.tongue(), blush: MAT.blush(),
    brow: new THREE.MeshStandardMaterial({ color: "#b8b2ab", roughness: 0.8 }),
    bundle: fabric("#e6dccb", 15, [2, 2]),
  };

  const root = new THREE.Group();
  const J = {};
  J.pelvis = joint(root, [0, BIPED.hipHeight, 0], "YXZ");

  // ---- skirt (chima): pleated bell, deformed per frame for flare/sway ----
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    prof.push(new THREE.Vector2(0.118 + 0.11 * Math.pow(k, 1.2) + 0.022 * Math.sin(Math.PI * k), 0.2 - 0.37 * k));
  }
  prof.reverse();
  const skirtGeo = new THREE.LatheGeometry(prof, 72);
  const sp = skirtGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    const k = (0.2 - y) / 0.37, a = Math.atan2(z, x), pleat = 1 + 0.03 * k * Math.cos(a * 20);
    sp.setXYZ(i, x * pleat, y, z * pleat);
  }
  skirtGeo.computeVertexNormals();
  const skirtBase = Float32Array.from(sp.array);
  M.skirt.side = THREE.DoubleSide;
  const skirt = mesh(skirtGeo, M.skirt);
  J.pelvis.add(skirt);

  // ---- legs: white wrapped leggings + straw shoes ----
  for (const s of ["L", "R"]) {
    const x = s === "L" ? 0.055 : -0.055;
    J["hip" + s] = joint(J.pelvis, [x, 0, 0]);
    J["hip" + s].add(mesh(capsule(0.042, 0.14), M.white, { pos: [0, -0.095, 0] }));
    J["knee" + s] = joint(J["hip" + s], [0, -BIPED.thigh, 0]);
    J["knee" + s].add(mesh(capsule(0.038, 0.15), M.white, { pos: [0, -0.095, 0] }));
    J["ankle" + s] = joint(J["knee" + s], [0, -BIPED.shin, 0]);
    J["ankle" + s].add(mesh(sphere(0.05), M.straw, { pos: [0, -0.018, 0.028], scale: [0.85, 0.55, 1.45] }));
  }

  // ---- torso: jeogori (short jacket) ----
  J.spine = joint(J.pelvis, [0, 0.1, 0], "YXZ");
  J.chest = joint(J.spine, [0, 0.11, 0], "YXZ");
  J.chest.add(mesh(new THREE.CylinderGeometry(0.118, 0.152, 0.25, SEG), M.top, { pos: [0, 0.03, 0], scale: [1, 1, 0.86] }));
  J.chest.add(mesh(sphere(0.12), M.top, { pos: [0, 0.15, 0], scale: [1.05, 0.5, 0.88] })); // rounded shoulders
  // collar (dongjeong) band and crossed V lapels
  J.chest.add(mesh(new THREE.TorusGeometry(0.068, 0.014, 10, 32), M.white, { pos: [0, 0.205, 0.005], rot: [Math.PI / 2 + 0.25, 0, 0] }));
  for (const [x, r] of [[0.03, 0.55], [-0.03, -0.55]]) {
    J.chest.add(mesh(new THREE.BoxGeometry(0.026, 0.15, 0.012), M.white, { pos: [x, 0.12, 0.103], rot: [-0.25, 0, r] }));
  }
  // goreum ribbon: bow + two streamers (streamers flutter)
  const bow = joint(J.chest, [0.035, 0.07, 0.12]);
  bow.add(mesh(new THREE.TorusGeometry(0.026, 0.009, 8, 20), M.ribbon, { pos: [0.022, 0, 0], scale: [1.2, 0.7, 0.4] }));
  bow.add(mesh(new THREE.TorusGeometry(0.026, 0.009, 8, 20), M.ribbon, { pos: [-0.022, 0, 0], scale: [1.2, 0.7, 0.4] }));
  bow.add(mesh(sphere(0.013), M.ribbon));
  J.ribbonA = joint(bow, [0.008, -0.005, 0.004]);
  J.ribbonA.add(mesh(new THREE.BoxGeometry(0.028, 0.2, 0.006), M.ribbon, { pos: [0, -0.1, 0] }));
  J.ribbonB = joint(bow, [-0.01, -0.005, 0.0]);
  J.ribbonB.add(mesh(new THREE.BoxGeometry(0.026, 0.17, 0.006), M.ribbon, { pos: [0, -0.085, 0] }));

  // ---- arms: wide sleeves with white cuffs, hands ----
  for (const s of ["L", "R"]) {
    const x = s === "L" ? 0.15 : -0.15, out = s === "L" ? 1 : -1;
    J["shoulder" + s] = joint(J.chest, [x, 0.15, 0], "ZXY");
    J["shoulder" + s].add(mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.17, 20), M.top, { pos: [0, -0.085, 0] }));
    J["shoulder" + s].add(mesh(sphere(0.056), M.top, { pos: [0, -0.005, 0] }));
    J["elbow" + s] = joint(J["shoulder" + s], [0, -0.16, 0]);
    J["elbow" + s].add(mesh(sphere(0.057), M.top));
    J["elbow" + s].add(mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.13, 20), M.top, { pos: [0, -0.065, 0] }));
    J["elbow" + s].add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 20), M.white, { pos: [0, -0.145, 0] }));
    J["hand" + s] = joint(J["elbow" + s], [0, -0.18, 0]);
    J["hand" + s].add(mesh(sphere(0.036), M.skin, { scale: [0.9, 1.05, 0.75] }));
    for (let f = 0; f < 4; f++) {
      J["hand" + s].add(mesh(capsule(0.009, 0.025), M.skin, { pos: [(-0.018 + f * 0.012) * out, -0.035, 0.012], rot: [0.5, 0, 0] }));
    }
    J["hand" + s].add(mesh(capsule(0.01, 0.022), M.skin, { pos: [0.028 * out, -0.012, 0.022], rot: [0.6, 0, -0.6 * out] }));
  }

  // basket hugged on her left hip (attached to the chest so it rides with the torso)
  const basket = joint(J.chest, [0.17, -0.07, 0.11], "XYZ");
  basket.rotation.set(0.15, -0.5, 0.1);
  const bp = [];
  for (let i = 0; i <= 10; i++) { const k = i / 10; bp.push(new THREE.Vector2(0.05 + 0.04 * Math.sin(k * Math.PI * 0.55), -0.05 + 0.1 * k)); }
  const strawB = MAT.straw();
  strawB.side = THREE.DoubleSide;
  basket.add(mesh(new THREE.LatheGeometry(bp, 28), strawB, { scale: [1.15, 1, 0.9] }));
  basket.add(mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 30, Math.PI), M.straw, { pos: [0, 0.05, 0], scale: [1.15, 1, 1] }));
  basket.add(mesh(sphere(0.06), M.bundle, { pos: [0, 0.05, 0], scale: [1.1, 0.75, 0.9] }));
  basket.add(mesh(sphere(0.02), M.bundle, { pos: [0, 0.098, 0] }));

  // ---- head ----
  J.neck = joint(J.chest, [0, 0.215, 0], "YXZ");
  J.neck.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 16), M.skin, { pos: [0, 0.02, 0] }));
  J.head = joint(J.neck, [0, 0.165, 0.01], "YXZ");
  J.head.add(mesh(sphere(0.15, 48, 36), M.skin, { scale: [1, 1.03, 0.97] }));
  J.head.add(mesh(sphere(0.1), M.skin, { pos: [0, -0.06, 0.03], scale: [1.15, 0.8, 1.05] })); // round jowls/chin
  for (const x of [0.15, -0.15]) J.head.add(mesh(sphere(0.03), M.skin, { pos: [x, -0.005, -0.01], scale: [0.5, 1, 0.8] }));
  J.head.add(mesh(sphere(0.028), M.skin, { pos: [0, -0.02, 0.152], scale: [1.05, 0.9, 0.85] })); // nose
  for (const x of [0.085, -0.085]) {
    const b = mesh(new THREE.CircleGeometry(0.03, 20), M.blush, { pos: [x, -0.045, 0.128], rot: [0, x > 0 ? 0.55 : -0.55, 0], shadow: false });
    J.head.add(b);
  }
  // hair: top cap + back + bun + hairpin
  J.head.add(mesh(new THREE.SphereGeometry(0.159, 40, 20, 0, Math.PI * 2, 0, 1.08), M.hair, { pos: [0, 0.012, -0.006], rot: [-0.12, 0, 0] }));
  J.head.add(mesh(new THREE.BoxGeometry(0.006, 0.05, 0.01), M.brow, { pos: [0, 0.138, 0.06], rot: [-0.45, 0, 0] })); // center part
  J.head.add(mesh(new THREE.SphereGeometry(0.158, 40, 24, Math.PI, Math.PI, 0, 2.3), M.hair, { pos: [0, 0.0, -0.006] }));
  for (const sd of [1, -1]) J.head.add(mesh(sphere(0.075), M.hair, { pos: [sd * 0.105, 0.045, -0.035], scale: [0.62, 0.95, 1.15] })); // swept-back side volume
  J.bun = joint(J.head, [0, 0.12, -0.1]);
  J.bun.add(mesh(sphere(0.062), M.hair, { scale: [1, 0.85, 0.95] }));
  J.bun.add(mesh(new THREE.TorusGeometry(0.05, 0.026, 12, 28), M.hair, { pos: [0, -0.01, 0], rot: [Math.PI / 2, 0, 0] }));
  J.bun.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8), M.wood, { rot: [0, 0, Math.PI / 2 - 0.12], pos: [0.01, 0.01, 0] }));

  // eyes: white, iris, pupil, glint (eyeball groups rotate to look), upper lids blink/widen
  J.eyes = [];
  J.lids = [];
  for (const x of [0.055, -0.055]) {
    const socket = joint(J.head, [x, 0.02, 0.118]);
    socket.add(mesh(sphere(0.036), M.eyeWhite, { scale: [1, 1.08, 0.85] }));
    const ball = joint(socket, [0, 0, 0], "YXZ");
    ball.add(mesh(sphere(0.019), M.iris, { pos: [0, 0, 0.026], scale: [1, 1, 0.45] }));
    ball.add(mesh(sphere(0.0105), M.pupil, { pos: [0, 0, 0.033], scale: [1, 1, 0.4] }));
    ball.add(mesh(sphere(0.0055), M.glint, { pos: [0.007, 0.008, 0.036], shadow: false }));
    J.eyes.push(ball);
    const lid = joint(socket, [0, 0, 0]);
    lid.add(mesh(new THREE.SphereGeometry(0.039, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.skin, { scale: [1, 1.08, 0.9] }));
    J.lids.push(lid);
    // eyebrow
    const brow = joint(J.head, [x, 0.077, 0.132]);
    brow.add(mesh(capsule(0.009, 0.04), M.brow, { rot: [0, 0, Math.PI / 2] }));
    (J.brows ??= []).push(brow);
  }
  // mouth: dark cavity scaled by jaw, upper teeth, tongue
  J.mouth = joint(J.head, [0, -0.072, 0.128]);
  J.mouth.add(mesh(sphere(0.04), M.mouth, { scale: [1.2, 1, 0.45] }));
  J.mouthTeeth = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), M.teeth, { pos: [0, 0.03, 0.006] });
  J.mouth.add(J.mouthTeeth);
  J.mouth.add(mesh(sphere(0.022), M.tongue, { pos: [0, -0.022, 0.004], scale: [1.2, 0.5, 0.6] }));

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  function setPose(p) {
    J.pelvis.position.y = BIPED.hipHeight + p.hip.y;
    J.pelvis.rotation.set(p.hip.pitch, p.hip.rotY, p.hip.rotZ);
    for (const s of ["L", "R"]) {
      J["hip" + s].rotation.x = -p[s].hip;
      J["knee" + s].rotation.x = -p[s].knee;
      J["ankle" + s].rotation.x = -p[s].ankle;
      const a = p["arm" + s], out = s === "L" ? 1 : -1;
      J["shoulder" + s].rotation.set(-a.sh, 0, 0.22 * out + (a.out ?? 0) * out);
      J["elbow" + s].rotation.x = a.el;
    }
    J.chest.rotation.set(p.chest.pitch, p.chest.rotY, 0);
    J.head.rotation.set(p.head.pitch, p.head.rotY, p.head.roll ?? 0);
  }

  function setFace(f) {
    J.brows.forEach((b, i) => {
      const side = i === 0 ? 1 : -1; // inner ends rise when worried (brow > 0)
      b.rotation.z = -0.4 * f.brow * side;
      b.position.y = 0.077 + 0.012 * f.brow;
    });
    J.lids.forEach((l) => (l.rotation.x = -1.55 + 1.45 * f.lid)); // 0: wide open, 1: closed
    J.eyes.forEach((e) => e.rotation.set(-f.eyeY * 0.4, f.eyeX * 0.5, 0));
    J.mouth.scale.set(1 + 0.15 * f.jaw, 0.25 + 1.25 * f.jaw, 1);
  }

  // secondary motion: skirt flare + sway from leg swing, ribbon streamers, bun wobble
  function setSecondary(t, p, speed = 0) {
    const swing = (p.L.footFwd ?? 0) - (p.R.footFwd ?? 0);
    const flare = 0.04 * Math.min(1, speed) + 0.03 * Math.abs(Math.sin(t * 15));
    for (let i = 0; i < sp.count; i++) {
      const bx = skirtBase[i * 3], by = skirtBase[i * 3 + 1], bz = skirtBase[i * 3 + 2];
      const k = Math.max(0, (0.2 - by) / 0.37), k2 = k * k;
      const r = Math.hypot(bx, bz) || 1;
      const ax = bx / r, az = bz / r;
      // flare outward, trail backward with speed, push the side of the forward leg
      const push = 0.06 * k2 * swing * Math.sign(bx || 1) * Math.max(0, az);
      sp.setXYZ(i, bx + ax * flare * k2, by + 0.02 * k2 * Math.sin(t * 9 + bx * 20), bz + az * flare * k2 - 0.035 * k2 * speed + push);
    }
    sp.needsUpdate = true;
    skirtGeo.computeVertexNormals();
    J.ribbonA.rotation.set(-0.5 * speed - 0.15 * Math.sin(t * 13), 0, 0.2 * Math.sin(t * 7));
    J.ribbonB.rotation.set(-0.4 * speed - 0.15 * Math.sin(t * 11 + 1), 0, -0.15 + 0.2 * Math.sin(t * 8 + 2));
    J.bun.rotation.set(0.06 * Math.sin(t * 15), 0, 0.04 * Math.sin(t * 15 + 1));
  }

  return { root, joints: J, setPose, setFace, setSecondary };
}
