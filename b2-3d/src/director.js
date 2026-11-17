// Director: places the rigs on the terrain each frame, runs the per-shot cameras and the post fx timeline.
import * as THREE from "three";
import { makeChoreo } from "./choreo.js";
import { placeBiped, placeQuad, rootFrame } from "./anim/ground.js";
import { noise1 } from "./rng.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (s) => { const k = Math.min(1, Math.max(0, s)); return k * k * (3 - 2 * k); };

export function createDirector({ tl, timing, terrain, sky, grandma, tiger, camera }) {
  const C = makeChoreo(timing);
  const F = timing.freeze;
  const S = Object.fromEntries(timing.shots.map((s) => [s.id, s]));
  const { heightAt, trailOffset } = terrain;
  const trail = (z, dx = 0, dy = 0) => { const x = terrain.pathXAt(z) + dx; return V(x, heightAt(x, z) + dy, z); };

  // GSAP drives each shot's progress 0..1 (with its own ease) and the post fx; cameras are functions of it
  const prog = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 };
  const eases = { S1: "sine.inOut", S2: "none", S3: "power1.out", S4: "sine.inOut", S5: "power2.in" };
  for (const s of timing.shots) {
    const end = s.id === "S5" ? F : s.end;
    tl.fromTo(prog, { [s.id]: 0 }, { [s.id]: 1, duration: end - s.start, ease: eases[s.id], immediateRender: false }, s.start);
  }
  const fx = { sat: 1, vig: 0.3, fade: 0, flash: 0 };
  tl.set(fx, { sat: 0.35, vig: 0.75, flash: 0.45 }, F);
  tl.to(fx, { flash: 0, duration: 0.08, ease: "power1.out" }, F);
  tl.fromTo(fx, { fade: 0 }, { fade: 1, duration: timing.duration - timing.black - 0.1, ease: "none", immediateRender: false }, timing.black);
  tl.set({}, {}, timing.duration);

  const gWorld = V(), tWorld = V(), tHead = V(), gHead = V();
  function placeRigs(t) {
    const g = C.grandmaAt(t);
    const pg = placeBiped(g, heightAt, trailOffset);
    grandma.root.position.set(pg.root.x, pg.root.y, pg.root.z);
    grandma.root.rotation.y = pg.root.yaw;
    grandma.setPose(pg.pose);
    grandma.setFace(g.face);
    grandma.setSecondary(t, pg.pose, 1);
    gWorld.copy(grandma.root.position);
    grandma.root.updateMatrixWorld(true);
    grandma.joints.head.getWorldPosition(gHead);

    const k = C.tigerAt(t);
    tiger.root.visible = k.visible;
    if (k.visible) {
      const pq = placeQuad(k, heightAt, trailOffset);
      tiger.setPose(pq.pose);
      tiger.root.position.set(pq.root.x, pq.torsoY - 0.55 - pq.pose.body.y, pq.root.z);
      tiger.root.rotation.y = pq.root.yaw;
      tiger.setFace(k.face);
      tiger.update(t);
      tiger.root.updateMatrixWorld(true);
      tWorld.copy(tiger.root.position);
      tiger.joints.head.getWorldPosition(tHead);
    }
    return { g, k };
  }

  function shake(t, amp) {
    return V(noise1(t * 11, 3) * amp, noise1(t * 11, 7) * amp, noise1(t * 11, 13) * amp * 0.5);
  }

  function shotCamera(t) {
    const shot = timing.shots.find((s) => t >= s.start && t < s.end) ?? timing.shots[timing.shots.length - 1];
    const p = prog[shot.id];
    const pos = V(), look = V();
    let fov = 40;
    if (shot.id === "S1") { // high crane down over the trail, valley on the right
      const a = trail(4, 2.8, 3.8), b = trail(4, 2.3, 2.0);
      pos.lerpVectors(a, b, p);
      look.copy(trail(-9, 0.3, 0.6));
      fov = 42;
    } else if (shot.id === "S2") { // in front of grandma, dollying back with her
      const r = rootFrame(C.grandmaAt(t).z, 0, heightAt, trailOffset);
      const d = 2.6 - 0.5 * p;
      pos.set(gWorld.x + r.f[0] * d - r.l[0] * 0.4, 0, gWorld.z + r.f[1] * d - r.l[1] * 0.4);
      pos.y = Math.max(gWorld.y + 0.55, heightAt(pos.x, pos.z) + 0.3);
      look.copy(gWorld).add(V(0, 0.62, 0));
      fov = 38;
      pos.add(shake(t, 0.01));
    } else if (shot.id === "S3") { // low, behind the foreground bush; grandma runs past, the tiger bursts out
      pos.copy(trail(-3.1, -1.45, 0.42));
      const target = tiger.root.visible ? tWorld.clone().add(V(0, 0.45, 0)) : trail(-8, -1.5, 0.4);
      look.lerpVectors(trail(-6.5, -0.6, 0.6), target, smooth((t - S.S3.start) / 0.6));
      fov = 44 - 6 * p;
      pos.add(shake(t, 0.05 * Math.exp(-(t - S.S3.start - 0.5) * 3) + 0.008));
    } else if (shot.id === "S4") { // orbit two-shot from the uphill side: tiger left, grandma right
      const center = gWorld.clone().lerp(tWorld, 0.5).add(V(0, 0.55, 0));
      const r = rootFrame((gWorld.z + tWorld.z) / 2, 0, heightAt, trailOffset);
      const ang = THREE.MathUtils.degToRad(80 - 35 * p), R = 3.5 - 1.0 * p;
      // rotate the "uphill side" vector (+l) toward the travel direction by `ang`
      const sideX = r.l[0], sideZ = r.l[1], fx_ = r.f[0], fz_ = r.f[1];
      // l points to the valley side (+x); the uphill side is -l
      const dx = -sideX * Math.sin(ang) + fx_ * Math.cos(ang), dz = -sideZ * Math.sin(ang) + fz_ * Math.cos(ang);
      pos.set(center.x + dx * R, 0, center.z + dz * R);
      pos.y = Math.max(center.y + 0.45, heightAt(pos.x, pos.z) + 1.0);
      look.copy(center).add(V(0, -0.1, 0));
      fov = 40;
      pos.add(shake(t, 0.012));
    } else { // S5: in front of grandma, looking back as the tiger pounces over her
      const r = rootFrame(gWorld.z, 0, heightAt, trailOffset);
      pos.set(gWorld.x + r.f[0] * 2.3 - r.l[0] * 0.3, gWorld.y + 1.05, gWorld.z + r.f[1] * 2.3 - r.l[1] * 0.3);
      look.copy(gHead).lerp(tHead, 0.55 + 0.35 * p);
      fov = 42 - 14 * p;
      pos.add(shake(Math.min(t, F), 0.01 + 0.03 * p));
    }
    camera.position.copy(pos);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(look);
    camera.updateMatrixWorld();
    return gWorld.clone().lerp(tiger.root.visible ? tWorld : gWorld, 0.5);
  }

  return {
    fx,
    apply(t) {
      const tt = Math.min(t, F);
      placeRigs(tt);
      const focus = shotCamera(tt);
      sky.focus(focus);
      sky.update(tt);
    },
  };
}
