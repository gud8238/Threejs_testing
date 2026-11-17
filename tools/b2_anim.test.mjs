// node --test tools/b2_anim.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { bipedRun, quadGallop, legIK, BIPED } from "../b2-3d/src/anim/gait.js";
import { blendPose, stateWeights, flatten } from "../b2-3d/src/anim/blend.js";
import { faceAt, jawTalk } from "../b2-3d/src/anim/face.js";

const maxDelta = (a, b) => {
  const fa = flatten(a), fb = flatten(b);
  assert.equal(fa.length, fb.length);
  return Math.max(...fa.map((v, i) => Math.abs(v - fb[i])));
};

test("biped stance foot stays planted in world (slide < 3% of stride)", () => {
  const stride = 0.7, hz = 2.4; // grandma: short quick steps (full cycles per second)
  const speed = stride * hz;
  for (const side of ["L", "R"]) {
    let worst = 0;
    for (let i = 0; i < 300; i++) {
      const t0 = i / 300, t1 = t0 + 1 / 600;
      const a = bipedRun(t0 * hz, { stride }), b = bipedRun(t1 * hz, { stride });
      if (a[side].stance && b[side].stance) {
        const worldA = t0 * speed + a[side].footFwd, worldB = t1 * speed + b[side].footFwd;
        worst = Math.max(worst, Math.abs(worldB - worldA));
      }
    }
    assert.ok(worst < 0.03 * stride / 30, `${side} slide per step ${worst}`);
  }
});

test("biped has a flight phase and alternating stance", () => {
  let flight = false, both = false;
  for (let p = 0; p < 1; p += 0.01) {
    const s = bipedRun(p, { stride: 1 });
    if (!s.L.stance && !s.R.stance) flight = true;
    if (s.L.stance && s.R.stance) both = true;
  }
  assert.ok(flight && !both);
});

test("gallop stance feet stay planted too", () => {
  const stride = 2.0, hz = 1.8, speed = stride * hz;
  for (const leg of ["FL", "FR", "HL", "HR"]) {
    for (let i = 0; i < 200; i++) {
      const t0 = i / 200, t1 = t0 + 1 / 600;
      const a = quadGallop(t0 * hz, { stride }), b = quadGallop(t1 * hz, { stride });
      if (a[leg].stance && b[leg].stance) {
        const d = Math.abs(t1 * speed + b[leg].footFwd - (t0 * speed + a[leg].footFwd));
        assert.ok(d < 0.03 * stride / 30, `${leg} slide ${d}`);
      }
    }
  }
});

// A pop is a discontinuity: sampled at 1/3000 s, a continuous joint can't move more than ~2 degrees.
// (Fast limbs legitimately exceed 25 deg per 30 fps frame, so per-frame size alone can't tell a pop.)
const POP = (2 * Math.PI) / 180;
test("no joint pops: gaits are continuous", () => {
  for (const [fn, hz, stride] of [[bipedRun, 2.4, 0.7], [quadGallop, 1.8, 2.0]]) {
    for (let i = 0; i < 6000; i++) {
      const t = i / 3000;
      const a = fn(t * hz, { stride }), b = fn((t + 1 / 3000) * hz, { stride });
      assert.ok(maxDelta(a, b) < POP, `${fn.name} t=${t}`);
    }
  }
});

test("state blends are continuous across a switch", () => {
  const keys = [[0, "a"], [0.5, "b"]];
  const poses = (t) => ({ a: bipedRun(t * 2.4, { stride: 0.7 }), b: quadGallop(t * 1.8, { stride: 2.0 }).HL });
  const at = (t) => {
    const w = stateWeights(t, keys);
    const P = poses(t);
    return { hip: (w.a ?? 0) * P.a.L.hip + (w.b ?? 0) * P.b.upper };
  };
  for (let i = 0; i < 3000; i++) {
    const t = 0.4 + i / 10000;
    assert.ok(maxDelta(at(t), at(t + 1 / 10000)) < POP, `t=${t}`);
  }
});

test("state changes blend over time instead of switching in one frame", () => {
  const keys = [[0, "crouch"], [1.0, "gallop"]];
  const w0 = stateWeights(1.0, keys), w1 = stateWeights(1.1, keys), w2 = stateWeights(1.3, keys);
  assert.ok(w0.crouch > 0.99);
  assert.ok(w1.gallop > 0 && w1.gallop < 1);
  assert.ok(w2.gallop > 0.99);
  const A = { x: 0, arr: [0, 1] }, B = { x: 1, arr: [2, 3] };
  assert.deepEqual(blendPose(A, B, 0.5), { x: 0.5, arr: [1, 2] });
});

test("legIK reaches reachable targets and clamps unreachable ones", () => {
  const { thigh, shin } = BIPED;
  const r = legIK(0.1, 0.3, thigh, shin);
  const fx = thigh * Math.sin(r.hip) + shin * Math.sin(r.hip + r.knee);
  const fy = thigh * Math.cos(r.hip) + shin * Math.cos(r.hip + r.knee);
  assert.ok(Math.abs(fx - 0.1) < 1e-6 && Math.abs(fy - 0.3) < 1e-6);
  const far = legIK(0, 10, thigh, shin);
  assert.ok(Number.isFinite(far.hip) && Math.abs(far.knee) < 0.6 && Math.abs(far.knee) > 0.05); // stays softly bent
});

test("faces ease between keys; jaw talks on syllables", () => {
  const keys = [[0, { brow: 0, lid: 0, jaw: 0, eyeX: 0, eyeY: 0 }], [1, { brow: 1, lid: 0, jaw: 1, eyeX: 0, eyeY: 0 }]];
  assert.equal(faceAt(0.5, keys).brow, 0);
  assert.ok(faceAt(1.1, keys).brow > 0 && faceAt(1.1, keys).brow < 1);
  assert.equal(faceAt(2, keys).jaw, 1);
  const syl = [[0, 0.2, 1], [0.3, 0.2, 0.5]];
  assert.ok(jawTalk(0.1, syl) > 0.9);
  assert.equal(jawTalk(0.25, syl), 0);
  assert.equal(jawTalk(0.1, syl), jawTalk(0.1, syl));
});
