// Procedural gaits as pure functions of phase (cycles). Distances in world units, angles in radians.
// Stance feet move backward at exactly body speed, so they stay planted in world space.

export const BIPED = { thigh: 0.19, shin: 0.19, hipHeight: 0.32 };
export const QUAD = { front: [0.27, 0.27], hind: [0.3, 0.29], frontHeight: 0.45, hindHeight: 0.48 };

const frac = (x) => x - Math.floor(x);
const smooth = (s) => s * s * (3 - 2 * s);
const TAU = Math.PI * 2;

// 2-bone IK in the sagittal plane. fwd = foot ahead of hip, down = foot below hip.
// Angles are measured from straight down, positive = forward. bend -1: knee forward (human), +1: joint backward.
export function legIK(fwd, down, l1, l2, bend = -1) {
  // soft reach: the leg eases toward 97% extension instead of snapping straight (no IK singularity)
  const L = l1 + l2, raw = Math.hypot(fwd, down);
  const d = Math.max(raw > 0.9 * L ? 0.9 * L + 0.07 * L * Math.tanh((raw - 0.9 * L) / (0.07 * L)) : raw,
    Math.abs(l1 - l2) + 1e-6);
  const cosK = Math.min(1, Math.max(-1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
  const cosH = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const base = Math.atan2(fwd, down);
  return { hip: base - bend * Math.acos(cosH), knee: bend * (Math.PI - Math.acos(cosK)) };
}

// one leg's foot track: stance slides back at body speed, swing arcs forward
function footTrack(p, duty, stride, lift) {
  const D = duty * stride;
  if (p < duty) return { stance: true, footFwd: D / 2 - (p / duty) * D, footUp: 0, s: 0 };
  const s = (p - duty) / (1 - duty);
  return { stance: false, footFwd: -D / 2 + D * smooth(s), footUp: lift * Math.sin(Math.PI * s), s };
}

export function bipedRun(phase, { stride, lift = 0.07, bob = 0.022 }) {
  const duty = 0.4;
  const hipY = -bob * Math.cos(2 * TAU * (phase - duty / 2));
  const leg = (off) => {
    const f = footTrack(frac(phase + off), duty, stride, lift);
    const ik = legIK(f.footFwd, BIPED.hipHeight + hipY - f.footUp, BIPED.thigh, BIPED.shin, -1);
    const { s, ...track } = f;
    return { ...track, hip: ik.hip, knee: ik.knee, ankle: -(ik.hip + ik.knee) - 0.35 * Math.sin(Math.PI * s) };
  };
  const L = leg(0), R = leg(0.5);
  const sw = Math.sin(TAU * phase);
  return {
    hip: { y: hipY, rotY: 0.16 * sw, rotZ: 0.04 * Math.sin(2 * TAU * phase), pitch: 0.12 },
    L, R,
    armL: { sh: -0.55 * sw + 0.2, el: -1.2 + 0.25 * sw },
    armR: { sh: 0.55 * sw + 0.2, el: -1.0 - 0.25 * sw },
    chest: { rotY: -0.1 * sw, pitch: 0.06 },
    head: { rotY: 0.05 * sw, pitch: -0.12 + 0.05 * Math.sin(2 * TAU * (phase - 0.1)) },
  };
}

export function quadGallop(phase, { stride, lift = 0.12 }) {
  const duty = 0.25;
  const flex = 0.22 * Math.sin(TAU * (phase - 0.05));
  const bodyY = -0.035 * Math.cos(TAU * (phase - 0.25));
  const leg = (off, [l1, l2], h, bend) => {
    const f = footTrack(frac(phase + off), duty, stride, lift);
    const ik = legIK(f.footFwd, h + bodyY - f.footUp, l1, l2, bend);
    const { s, ...track } = f;
    return { ...track, upper: ik.hip, lower: ik.knee, paw: -(ik.hip + ik.knee) * 0.6 - 0.5 * Math.sin(Math.PI * s) };
  };
  return {
    body: { y: bodyY, pitch: 0.06 * Math.sin(TAU * (phase - 0.3)) },
    spine: [flex * 0.6, flex, flex * 0.6],
    HL: leg(0.0, QUAD.hind, QUAD.hindHeight, -1),
    HR: leg(0.1, QUAD.hind, QUAD.hindHeight, -1),
    FL: leg(0.45, QUAD.front, QUAD.frontHeight, 1),
    FR: leg(0.55, QUAD.front, QUAD.frontHeight, 1),
    head: { pitch: -0.7 * flex, rotY: 0 },
    tail: [0, 1, 2, 3, 4, 5].map((i) => 0.22 * Math.sin(TAU * (phase - i * 0.07)) + [0.35, 0.15, 0.05, -0.1, -0.2, -0.25][i]),
  };
}

// neutral standing pose with the same shape as bipedRun's output
export function bipedStand() {
  const ik = legIK(0, BIPED.hipHeight, BIPED.thigh, BIPED.shin, -1);
  const leg = { stance: true, footFwd: 0, footUp: 0, hip: ik.hip, knee: ik.knee, ankle: -(ik.hip + ik.knee) };
  return {
    hip: { y: 0, rotY: 0, rotZ: 0, pitch: 0 }, L: { ...leg }, R: { ...leg },
    armL: { sh: 0.45, el: -1.35 }, armR: { sh: 0.05, el: -0.25 },
    chest: { rotY: 0, pitch: 0 }, head: { rotY: 0, pitch: 0 },
  };
}

// tiger standing pose with the same shape as quadGallop's output
export function quadStand() {
  const leg = ([l1, l2], h, bend) => {
    const ik = legIK(0, h, l1, l2, bend);
    return { stance: true, footFwd: 0, footUp: 0, upper: ik.hip, lower: ik.knee, paw: -(ik.hip + ik.knee) * 0.6 };
  };
  return {
    body: { y: 0, pitch: 0 }, spine: [0, 0, 0],
    HL: leg(QUAD.hind, QUAD.hindHeight, -1), HR: leg(QUAD.hind, QUAD.hindHeight, -1),
    FL: leg(QUAD.front, QUAD.frontHeight, 1), FR: leg(QUAD.front, QUAD.frontHeight, 1),
    head: { pitch: 0, rotY: 0 }, tail: [0.6, 0.35, 0.2, -0.25, -0.45, -0.5],
  };
}
