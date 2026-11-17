// Facial animation: keyed expressions eased over `trans` seconds, and syllable-driven jaw.
import { blendPose } from "./blend.js";

const smooth = (s) => { const k = Math.min(1, Math.max(0, s)); return k * k * (3 - 2 * k); };

export function faceAt(t, keys, trans = 0.2) {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
  if (i === 0 || keys[i][0] > t) return { ...keys[0][1] };
  return blendPose(keys[i - 1][1], keys[i][1], smooth((t - keys[i][0]) / trans));
}

// syllables: [[start, dur, open], ...] -> jaw opening 0..1
export function jawTalk(t, syllables) {
  for (const [s, d, open] of syllables) if (t >= s && t < s + d) return open * Math.sin((Math.PI * (t - s)) / d);
  return 0;
}
