// Per-shot camera on the GSAP timeline + seeded shake. Holds still after the freeze.
import { noise1 } from "./rng.js";

// look = reference-pixel point the camera aims at; pos = small world offsets (parallax)
const SHOTS = {
  S1: { from: { x: 0, y: 0, z: 0, lx: 836, ly: 470, fov: 40 }, to: { x: 0.05, y: 0, z: -0.35, lx: 820, ly: 480, fov: 38 }, ease: "sine.inOut", shake: 0 },
  S2: { from: { x: -0.02, y: 0.02, z: -0.2, lx: 560, ly: 330, fov: 31 }, to: { x: 0.1, y: 0, z: -0.3, lx: 780, ly: 470, fov: 31 }, ease: "power1.inOut", shake: 0.006 },
  S3: { from: { x: -0.06, y: 0, z: -0.2, lx: 580, ly: 520, fov: 35 }, to: { x: 0.06, y: 0, z: -0.32, lx: 740, ly: 560, fov: 33 }, ease: "power1.out", shake: 0.02 },
  S4: { from: { x: 0.06, y: 0.02, z: -0.25, lx: 760, ly: 520, fov: 34 }, to: { x: 0.2, y: 0, z: -0.35, lx: 980, ly: 610, fov: 33 }, ease: "none", shake: 0.012 },
  S5: { from: { x: 0, y: 0, z: -0.2, lx: 760, ly: 560, fov: 36 }, to: { x: 0, y: -0.02, z: -0.4, lx: 760, ly: 590, fov: 27 }, ease: "power2.in", shake: 0.03 },
};

export function createCameraRig(tl, timing) {
  const cam = { x: 0, y: 0, z: 0, lx: 836, ly: 470, fov: 40, shake: 0 };
  for (const s of timing.shots) {
    const k = SHOTS[s.id];
    const end = s.id === "S5" ? timing.freeze : s.end;
    // a cut is a 0 ms set at the shot start, then the move runs to the shot end
    tl.set(cam, { ...k.from, shake: k.shake }, s.start);
    tl.to(cam, { ...k.to, duration: end - s.start, ease: k.ease }, s.start);
  }
  // shake burst when the tiger bursts out
  tl.fromTo(cam, { shake: 0.05 }, { shake: SHOTS.S3.shake, duration: 0.6, ease: "power2.out" }, timing.shots[2].start);

  return {
    state: cam,
    apply(camera, bg, t) {
      const tt = Math.min(t, timing.freeze);
      const sx = noise1(tt * 9, 3) * cam.shake, sy = noise1(tt * 9, 7) * cam.shake;
      camera.position.set(cam.x + sx, cam.y + sy, cam.z);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      const target = bg.worldAt(cam.lx, cam.ly).normalize().multiplyScalar(10).add(camera.position);
      camera.lookAt(target);
      camera.updateMatrixWorld();
    },
  };
}
