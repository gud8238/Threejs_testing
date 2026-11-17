// Pose blending helpers (pure). Poses are nested objects/arrays of numbers (+ boolean flags).
const smooth = (s) => { const k = Math.min(1, Math.max(0, s)); return k * k * (3 - 2 * k); };

export function flatten(p, out = []) {
  if (typeof p === "number") out.push(p);
  else if (Array.isArray(p)) p.forEach((v) => flatten(v, out));
  else if (p && typeof p === "object") Object.keys(p).sort().forEach((k) => flatten(p[k], out));
  return out;
}

export function blendPose(a, b, w) {
  if (typeof a === "number") return a + (b - a) * w;
  if (typeof a === "boolean") return w < 0.5 ? a : b;
  if (Array.isArray(a)) return a.map((v, i) => blendPose(v, b[i], w));
  const o = {};
  for (const k of Object.keys(a)) o[k] = k in b ? blendPose(a[k], b[k], w) : a[k];
  return o;
}

// weights: {state: w}, poses: {state: pose} -> weighted pose
export function mixPoses(weights, poses) {
  let acc = null, total = 0;
  for (const [s, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    total += w;
    acc = acc === null ? poses[s] : blendPose(acc, poses[s], w / total);
  }
  return acc;
}

// keys: [[t, state], ...] sorted. New state fades in over `fade` seconds from its key time.
export function stateWeights(t, keys, fade = 0.2) {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
  if (keys[i][0] > t || i === 0) return { [keys[0][1]]: 1 };
  const k = smooth((t - keys[i][0]) / fade);
  const prev = keys[i - 1][1], cur = keys[i][1];
  if (prev === cur) return { [cur]: 1 };
  return { [prev]: 1 - k, [cur]: k };
}
