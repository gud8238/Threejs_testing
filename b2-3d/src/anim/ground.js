// Place rigs on uneven terrain: re-solve each leg's IK against the ground height under its foot.
// Pure (no three.js): heightAt(x,z), trailOffset(x,z) = x - trailX(z) are passed in.
import { BIPED, QUAD, legIK } from "./gait.js";

const trailX = (trailOffset, z) => -trailOffset(0, z);

export function rootFrame(z, lateral, heightAt, trailOffset) {
  const x = trailX(trailOffset, z) + lateral;
  const dxdz = (trailX(trailOffset, z + 0.1) - trailX(trailOffset, z - 0.1)) / 0.2;
  const yaw = Math.atan2(dxdz, 1);
  return { x, z, y: heightAt(x, z), yaw, f: [Math.sin(yaw), Math.cos(yaw)], l: [Math.cos(yaw), -Math.sin(yaw)] };
}

const at = (r, fwd, side) => [r.x + r.f[0] * fwd + r.l[0] * side, r.z + r.f[1] * fwd + r.l[1] * side];

export function placeBiped(c, heightAt, trailOffset) {
  const r = rootFrame(c.z, c.lateral, heightAt, trailOffset);
  const p = structuredClone(c.pose);
  const pitch = p.hip.pitch;
  const hipY = r.y + BIPED.hipHeight + p.hip.y;
  const feet = [];
  for (const [s, side] of [["L", 0.055], ["R", -0.055]]) {
    const leg = p[s];
    const [fx, fz] = at(r, leg.footFwd, side);
    const gy = heightAt(fx, fz);
    const ik = legIK(leg.footFwd, hipY - (gy + leg.footUp), BIPED.thigh, BIPED.shin, -1);
    const slope = Math.atan2(heightAt(...at(r, leg.footFwd + 0.05, side)) - heightAt(...at(r, leg.footFwd - 0.05, side)), 0.1);
    leg.hip = ik.hip + pitch; // the pelvis is pitched; legs are solved in world
    leg.knee = ik.knee;
    leg.ankle = -(ik.hip + ik.knee) + slope + (leg.ankle - (-(leg.hip - pitch + leg.knee)) || 0) * 0;
    const footY = hipY - (BIPED.thigh * Math.cos(ik.hip) + BIPED.shin * Math.cos(ik.hip + ik.knee));
    feet.push({ stance: leg.stance, x: fx, z: fz, y: footY });
  }
  return { root: r, pose: p, feet };
}

// torso-local (z, y) of the leg roots after body pitch and spine flex (mirrors tiger.js joints)
function quadRoots(p) {
  const rot = ([z, y], a) => [z * Math.cos(a) + y * Math.sin(a), y * Math.cos(a) - z * Math.sin(a)];
  let pz = -0.42, py = 0, a = 0;
  const hind = [pz, py - 0.07];
  for (const [dz, dy, k] of [[0.28, 0.01, 0], [0.28, 0.01, 1], [0.28, 0, 2]]) {
    const [vz, vy] = rot([dz, dy], a);
    pz += vz; py += vy;
    a += -p.spine[k] * 0 + p.spine[k]; // rotation.x = spine[k]
  }
  const [oz, oy] = rot([0, -0.1], a);
  const front = [pz + oz, py + oy];
  const tp = -p.body.pitch; // torso rotation.x
  return { hind: rot(hind, tp), front: rot(front, tp) };
}

export function placeQuad(c, heightAt, trailOffset) {
  const r = rootFrame(c.z, c.lateral, heightAt, trailOffset);
  const p = structuredClone(c.pose);
  // the body rides on the ground under its feet: height from the average, pitch from front-vs-hind slope
  const g = (fwd, side) => heightAt(...at(r, fwd, side));
  const gF = (g(0.42, 0.14) + g(0.42, -0.14)) / 2, gH = (g(-0.42, 0.13) + g(-0.42, -0.13)) / 2;
  p.body.pitch += Math.atan2(gF - gH, 0.84);
  let torsoY = (gF + gH) / 2 + 0.55 + p.body.y + (c.lift ?? 0);
  const roots = quadRoots(p);
  const legs = [["FL", 0.14], ["FR", -0.14], ["HL", 0.13], ["HR", -0.13]].map(([n, side]) => {
    const leg = p[n], front = n[0] === "F";
    const [rz, ry] = front ? roots.front : roots.hind;
    const nominal = front ? 0.42 : -0.42;
    const [fx, fz] = at(r, nominal + leg.footFwd, side);
    const [l1, l2] = front ? QUAD.front : QUAD.hind;
    return { n, leg, front, ry, fwd: nominal + leg.footFwd - rz, fx, fz, gy: heightAt(fx, fz), l1, l2 };
  });
  // pass 1: if a planted foot can't reach the ground, the body dips until it can
  let drop = 0;
  for (const L of legs) if (L.leg.stance) {
    const reach = 0.88 * (L.l1 + L.l2);
    const down = torsoY + L.ry - L.gy;
    const need = Math.sqrt(Math.max(0, reach * reach - L.fwd * L.fwd));
    drop = Math.max(drop, down - need);
  }
  torsoY -= drop;
  // pass 2: solve every leg against the ground under it
  const feet = [];
  for (const L of legs) {
    const rootY = torsoY + L.ry;
    const ik = legIK(L.fwd, rootY - (L.gy + L.leg.footUp), L.l1, L.l2, L.front ? 1 : -1);
    L.leg.upper = ik.hip - p.body.pitch;
    L.leg.lower = ik.knee;
    L.leg.paw = -(ik.hip + ik.knee) * 0.6 + (L.leg.pawExtra ?? 0);
    const footY = rootY - (L.l1 * Math.cos(ik.hip) + L.l2 * Math.cos(ik.hip + ik.knee));
    feet.push({ stance: L.leg.stance, x: L.fx, z: L.fz, y: footY });
  }
  return { root: r, pose: p, feet, torsoY };
}
