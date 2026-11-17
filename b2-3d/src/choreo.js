// Choreography: where each character is, what state it's in, and its face — pure functions of t.
import { bipedRun, quadGallop, quadStand } from "./anim/gait.js";
import { stateWeights, mixPoses, blendPose } from "./anim/blend.js";
import { faceAt, jawTalk } from "./anim/face.js";

const smooth = (s) => { const k = Math.min(1, Math.max(0, s)); return k * k * (3 - 2 * k); };
const lerpKeys = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
};
const smoothKeys = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
};

// "어흥~ 떡 하나 주면… 안 잡아먹지이~!" as syllables: [start, dur, open]
function tigerSyllables(t0) {
  const s = [[0, 0.32, 1], [0.34, 0.22, 0.7], [0.62, 0.14, 0.8], [0.78, 0.13, 0.6], [0.93, 0.13, 0.7], [1.08, 0.14, 0.6], [1.24, 0.16, 0.8],
    [1.62, 0.15, 0.8], [1.79, 0.13, 0.6], [1.94, 0.13, 0.7], [2.09, 0.13, 0.6], [2.24, 0.42, 0.9]];
  return s.map(([a, d, o]) => [t0 + a, d, o]);
}

export function makeChoreo(timing) {
  const S = Object.fromEntries(timing.shots.map((s) => [s.id, s]));
  const F = timing.freeze;
  const cue = (id) => timing.cues.find((c) => c.id === id).t;

  // ---- grandma ----
  const G_SPEED = 1.68, G_STRIDE = 0.7, G_Z0 = -11;
  const gFace = [
    [0, { brow: 1, lid: 0, jaw: 0.35, eyeX: 0, eyeY: 0 }],
    [cue("v1"), { brow: 1, lid: 0, jaw: 1, eyeX: 0, eyeY: 0.1 }],
    [cue("v1") + 1.0, { brow: 1, lid: 0, jaw: 0.45, eyeX: 0, eyeY: 0 }],
    [cue("v3"), { brow: 1.1, lid: 0, jaw: 1, eyeX: 0.6, eyeY: 0 }],
    [cue("v3") + 0.85, { brow: 1, lid: 0, jaw: 0.5, eyeX: 0, eyeY: 0 }],
  ];
  function grandmaRaw(t) {
    const z = G_Z0 + G_SPEED * t;
    const phase = (z - G_Z0) / G_STRIDE;
    const p = bipedRun(phase, { stride: G_STRIDE });
    const lb = smooth((t - (cue("v3") - 0.2)) / 0.25) * (1 - smooth((t - (cue("v3") + 0.85)) / 0.3));
    // basket arm hugs the basket; the free arm flails more while looking back
    p.armL = { sh: 0.55 + 0.05 * Math.sin(phase * 6.283), el: -1.55, out: 0.05 };
    p.armR = { sh: p.armR.sh * (1 - lb) + lb * -0.6, el: p.armR.el * (1 - lb) + lb * -0.5, out: 0.5 * lb };
    p.chest.rotY += -0.55 * lb;
    p.head.rotY += -1.35 * lb;
    p.head.pitch += -0.1 * lb;
    return { visible: true, z, lateral: 0.15 * Math.sin(t * 0.7), speed: G_SPEED, phase, pose: p, lookBack: lb, face: faceAt(t, gFace, 0.12) };
  }

  // ---- tiger ----
  const T_STRIDE = 1.4;
  const tZ = [[S.S3.start, -8.6], [S.S3.start + 0.5, -8.45], [S.S4.start, -3.9], [S.S5.start, 0.8], [S.S5.start + 0.25, 1.05], [F, 3.9]];
  const tLat = [[S.S3.start, -1.7], [S.S3.start + 0.5, -1.65], [S.S3.start + 1.2, -0.2], [F, -0.2]];
  const tStates = [[0, "crouch"], [S.S3.start + 0.5, "gallop"], [S.S5.start, "antic"], [S.S5.start + 0.25, "pounce"]];
  const talk = tigerSyllables(cue("v2"));

  function crouchPose(t) {
    const p = quadStand();
    const br = Math.sin(t * 6) * 0.01;
    p.body = { y: -0.17 + br, pitch: -0.06 };
    p.spine = [0.12, 0.18, 0.1];
    p.head = { pitch: 0.25, rotY: 0 };
    p.FL.footFwd = p.FR.footFwd = 0.08;
    p.HL.footFwd = p.HR.footFwd = -0.05;
    p.tail = [0.15, 0.1, 0.1, 0.05, 0, -0.1].map((a, i) => a + 0.15 * Math.sin(t * 3 - i * 0.7));
    return p;
  }
  function anticPose(t) {
    const p = crouchPose(t);
    p.body = { y: -0.24, pitch: 0.1 };
    p.spine = [0.25, 0.35, 0.2];
    p.head = { pitch: -0.15, rotY: 0 };
    return p;
  }
  function pouncePose() {
    const p = quadStand();
    p.body = { y: 0.0, pitch: 0.1 };
    p.spine = [-0.15, -0.2, -0.12];
    p.head = { pitch: 0.35, rotY: 0 };
    for (const n of ["FL", "FR"]) Object.assign(p[n], { stance: false, footFwd: 0.42, footUp: 0.42, pawExtra: -0.9 });
    for (const n of ["HL", "HR"]) Object.assign(p[n], { stance: false, footFwd: -0.45, footUp: 0.12, pawExtra: 0.6 });
    p.tail = [0.2, 0.1, 0.05, 0.0, -0.05, -0.1];
    return p;
  }

  function tigerRaw(t) {
    if (t < S.S3.start) return { visible: false };
    const z = lerpKeys(tZ, t);
    const phase = (z - tZ[0][1]) / T_STRIDE;
    const weights = stateWeights(t, tStates, 0.2);
    const poses = { crouch: crouchPose(t), gallop: quadGallop(phase, { stride: T_STRIDE }), antic: anticPose(t), pounce: pouncePose() };
    const pose = mixPoses(weights, poses);
    const pk = smooth((t - (S.S5.start + 0.25)) / (F - S.S5.start - 0.25));
    const lift = t > S.S5.start + 0.25 ? 0.5 * Math.sin(Math.PI * Math.min(pk, 0.55) / 1.1) : 0;
    let jaw = t >= talk[0][0] && t < S.S4.start ? jawTalk(t, talk) : 0.08;
    let brow = 0.55;
    if (t >= S.S5.start) { jaw = smooth((t - S.S5.start - 0.1) / 0.3); brow = 1; }
    else if (t >= S.S4.start) { jaw = 0.35 + 0.15 * Math.sin(t * 9); brow = 0.8; }
    return { visible: true, z, lateral: smoothKeys(tLat, t), phase, weights, pose, lift, face: { brow, lid: 0, jaw, eyeX: 0, eyeY: 0 } };
  }

  return { grandmaAt: (t) => grandmaRaw(Math.min(t, F)), tigerAt: (t) => tigerRaw(Math.min(t, F)) };
}
