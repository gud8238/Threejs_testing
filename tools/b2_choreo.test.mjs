// node --test tools/b2_choreo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import timing from "../b2-3d/assets/timing.json" with { type: "json" };
import { makeChoreo } from "../b2-3d/src/choreo.js";
import { heightAt, trailOffset } from "../b2-3d/src/terrain.js";
import { placeBiped, placeQuad } from "../b2-3d/src/anim/ground.js";

const C = makeChoreo(timing);
const S = Object.fromEntries(timing.shots.map((s) => [s.id, s]));

test("grandma runs downhill continuously; tiger closes the gap but never passes her before the pounce", () => {
  let prev = C.grandmaAt(0).z;
  for (let t = 0.1; t <= timing.freeze; t += 0.1) {
    const g = C.grandmaAt(t);
    assert.ok(g.z > prev, `grandma stalls at ${t}`);
    prev = g.z;
    if (t >= S.S3.start && t < S.S5.start) assert.ok(C.tigerAt(t).z < g.z, `tiger ahead at ${t}`);
  }
  const gap6 = C.grandmaAt(6).z - C.tigerAt(6).z, gap8 = C.grandmaAt(8).z - C.tigerAt(8).z;
  assert.ok(gap8 < gap6 && gap8 > 0.8, `gap6 ${gap6} gap8 ${gap8}`);
});

test("tiger: crouch -> gallop -> anticipation -> pounce, blended", () => {
  const w = (t) => C.tigerAt(t).weights;
  assert.ok(w(S.S3.start + 0.1).crouch > 0.99);
  assert.ok(w(S.S4.start).gallop > 0.99);
  assert.ok(w(S.S5.start + 0.15).antic > 0.5);
  assert.ok(w(S.S5.start + 0.8).pounce > 0.99);
  const mid = w(S.S3.start + 0.6);
  assert.ok(Object.values(mid).every((v) => v < 1), "switch must blend");
});

test("tiger talks in S3 and roars in S5; grandma screams at her cues", () => {
  const talk = [];
  for (let t = 3.8; t < 6; t += 1 / 30) talk.push(C.tigerAt(t).face.jaw);
  assert.ok(Math.max(...talk) > 0.5 && Math.min(...talk) < 0.15, "jaw should open and close");
  assert.ok(C.tigerAt(9.0).face.jaw > 0.9);
  for (const c of timing.cues.filter((c) => c.id === "v1" || c.id === "v3")) assert.ok(C.grandmaAt(c.t + 0.15).face.jaw > 0.8);
});

test("grandma looks back in S4", () => {
  const v3 = timing.cues.find((c) => c.id === "v3").t;
  assert.ok(C.grandmaAt(v3 + 0.3).lookBack > 0.9);
  assert.ok(C.grandmaAt(S.S2.start + 0.5).lookBack < 0.01);
});

test("frozen after the freeze; pure in t", () => {
  assert.deepEqual(C.tigerAt(timing.freeze + 0.4), C.tigerAt(timing.freeze));
  assert.deepEqual(C.grandmaAt(timing.freeze + 0.4), C.grandmaAt(timing.freeze));
  assert.deepEqual(C.tigerAt(5.123), C.tigerAt(5.123));
});

test("stance feet sit on the terrain (+-0.02) on the sloped trail", () => {
  let checked = 0;
  for (let t = S.S2.start; t < S.S4.end; t += 1 / 30) {
    const g = C.grandmaAt(t);
    const placed = placeBiped(g, heightAt, trailOffset);
    for (const f of placed.feet) if (f.stance) {
      assert.ok(Math.abs(f.y - heightAt(f.x, f.z)) < 0.02, `grandma t=${t.toFixed(2)} dy=${(f.y - heightAt(f.x, f.z)).toFixed(3)}`);
      checked++;
    }
    const k = C.tigerAt(t);
    if (k.visible && k.weights.gallop > 0.99) {
      for (const f of placeQuad(k, heightAt, trailOffset).feet) if (f.stance) {
        assert.ok(Math.abs(f.y - heightAt(f.x, f.z)) < 0.02, `tiger t=${t.toFixed(2)} dy=${(f.y - heightAt(f.x, f.z)).toFixed(3)}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 100);
});
