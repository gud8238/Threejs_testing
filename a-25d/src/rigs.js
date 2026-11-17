// Character rigs: pure functions of time -> pose + placement in reference-pixel space.
// No three.js here, so it can be unit-tested in node.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const EASE = {
  none: (k) => k,
  inOut: (k) => k * k * (3 - 2 * k),
  in2: (k) => k * k,
  out2: (k) => 1 - (1 - k) * (1 - k),
};

// keys: [[t, x, y], ...] -> {x, y} at time t (linear between keys, held at the ends)
function path(keys, t, ease = "none") {
  if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  for (let i = 1; i < keys.length; i++) {
    const [t1, x1, y1] = keys[i];
    if (t <= t1) {
      const [t0, x0, y0] = keys[i - 1];
      const k = EASE[ease](clamp01((t - t0) / (t1 - t0)));
      return { x: lerp(x0, x1, k), y: lerp(y0, y1, k) };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last[1], y: last[2] };
}

// one stride: pose alternates per step, body lifts mid-step, squashes on contact
function gait(t, { stepHz, poses, liftPx, squash = 0.06 }) {
  const ph = t * stepHz;
  const step = Math.floor(ph);
  const f = ph - step;
  const pose = poses[((step % poses.length) + poses.length) % poses.length];
  const lift = liftPx * Math.sin(Math.PI * f);
  let sx = 1, sy = 1;
  if (f < 0.18) {
    const c = 1 - f / 0.18;
    sy = 1 - squash * c;
    sx = 1 + squash * c;
  } else {
    const s = Math.sin(Math.PI * (f - 0.18) / 0.82);
    sy = 1 + squash * 0.6 * s;
    sx = 1 - squash * 0.4 * s;
  }
  return { pose, lift, sx, sy, stepStart: step / stepHz, contactAge: f / stepHz };
}

export function makeRigs(timing) {
  const S = Object.fromEntries(timing.shots.map((s) => [s.id, s]));
  const FREEZE = timing.freeze;
  const v3 = timing.cues.find((c) => c.id === "v3")?.t ?? S.S4.start + 0.2;

  const GRANDMA_PATHS = {
    S2: [[S.S2.start, 430, 390], [S.S2.end, 770, 600]],
    S3: [[S.S3.start, 860, 640], [S.S3.end, 1080, 740]],
    S4: [[S.S4.start, 990, 700], [S.S4.end, 1240, 850]],
    S5: [[S.S5.start, 1250, 860], [S.S5.end, 1420, 940]],
  };
  const TIGER_PATHS = {
    S3: [[S.S3.start, 170, 615], [S.S3.start + 0.45, 290, 618], [S.S3.end, 610, 665]],
    S4: [[S.S4.start, 430, 610], [S.S4.end, 830, 700]],
    S5: [[S.S5.start, 700, 670], [S.S5.end, 700, 670]],
  };
  const shotAt = (t) => timing.shots.find((s) => t >= s.start && t < s.end) ?? timing.shots[timing.shots.length - 1];

  function grandmaRaw(t, withGhosts) {
    const shot = shotAt(t);
    if (shot.id === "S1") return { visible: false };
    const p = path(GRANDMA_PATHS[shot.id], t);
    const g = gait(t, { stepHz: 4.5, poses: ["g_2", "g_3"], liftPx: 14 });
    let pose = g.pose;
    // the look-back wail: hold the look-back pose for ~0.9 s around her line
    if (shot.id === "S4" && t >= v3 - 0.15 && t < v3 + 0.85) pose = "g_4";
    const st = {
      visible: true, x: p.x, y: p.y, pose, lift: g.lift, sx: g.sx, sy: g.sy,
      lean: -0.05, toward: 0, shadow: 0.42 - g.lift / 60, ghosts: [],
      puff: { age: g.contactAge, ...path(GRANDMA_PATHS[shot.id], Math.max(shot.start, g.stepStart)) },
    };
    if (withGhosts) st.ghosts = ghostsOf(grandmaRaw, t, shot);
    return st;
  }

  function tigerRaw(t, withGhosts) {
    const shot = shotAt(t);
    if (shot.id === "S1" || shot.id === "S2") return { visible: false };
    const p = path(TIGER_PATHS[shot.id], t);
    let st;
    if (shot.id === "S3" && t < S.S3.start + 0.45) {
      // crouched creep out from behind the bush: slow breathing, no stride
      const br = Math.sin((t - S.S3.start) * 9);
      st = { pose: "t_2", lift: 0, sx: 1 + 0.015 * br, sy: 1 - 0.015 * br, lean: 0, shadow: 0.45, running: false };
    } else if (shot.id === "S5") {
      const k = clamp01((t - S.S5.start) / 0.25);
      if (k < 1) {
        // anticipation: squash down before the pounce
        st = { pose: "t_2", lift: 0, sx: 1 + 0.08 * k, sy: 1 - 0.1 * k, lean: 0, shadow: 0.45, running: false };
      } else {
        const a = EASE.in2(clamp01((t - S.S5.start - 0.25) / (FREEZE - S.S5.start - 0.25)));
        st = { pose: "t_5", lift: 40 * Math.sin(Math.PI * Math.min(a, 0.5)), sx: 0.97, sy: 1.04,
          lean: -0.08 * a, shadow: 0.3 * (1 - a), running: true, toward: a * 0.82 };
      }
    } else {
      const g = gait(t, { stepHz: 3.4, poses: ["t_3", "t_4"], liftPx: 26, squash: 0.07 });
      st = { pose: g.pose, lift: g.lift, sx: g.sx, sy: g.sy, lean: -0.04, shadow: 0.45 - g.lift / 80,
        running: true, puff: { age: g.contactAge, ...path(TIGER_PATHS[shot.id], Math.max(shot.start, g.stepStart)) } };
    }
    st = { visible: true, x: p.x, y: p.y, toward: 0, puff: null, ghosts: [], ...st };
    delete st.running;
    if (withGhosts && st.pose !== "t_2") st.ghosts = ghostsOf(tigerRaw, t, shot);
    return st;
  }

  function ghostsOf(fn, t, shot) {
    return [1, 2]
      .map((k) => ({ k, s: fn(Math.max(shot.start, t - k / 30), false) }))
      .map(({ k, s }) => ({ pose: s.pose, x: s.x, y: s.y, lift: s.lift, toward: s.toward, alpha: k === 1 ? 0.22 : 0.1 }));
  }

  const frozen = (fn) => (t) => fn(Math.min(t, FREEZE), true);
  return { grandmaAt: frozen(grandmaRaw), tigerAt: frozen(tigerRaw) };
}
