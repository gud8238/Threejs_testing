// node --test tools/rigs.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import timing from "../a-25d/assets/timing.json" with { type: "json" };
import { makeRigs } from "../a-25d/src/rigs.js";

const { grandmaAt, tigerAt } = makeRigs(timing);
const S = Object.fromEntries(timing.shots.map((s) => [s.id, s]));

test("grandma runs with alternating poses during S2", () => {
  const poses = new Set();
  for (let t = S.S2.start; t < S.S2.end; t += 1 / 30) poses.add(grandmaAt(t).pose);
  assert.ok(poses.has("g_2") && poses.has("g_3"), [...poses].join());
});

test("nobody is visible in S1; tiger hidden until S3", () => {
  assert.equal(grandmaAt(0.5).visible, false);
  assert.equal(tigerAt(0.5).visible, false);
  assert.equal(tigerAt(S.S2.end - 0.05).visible, false);
  assert.equal(tigerAt(S.S3.start + 0.05).visible, true);
});

test("grandma looks back (g_4) when she wails in S4", () => {
  const v3 = timing.cues.find((c) => c.id === "v3").t;
  assert.equal(grandmaAt(v3 + 0.1).pose, "g_4");
});

test("tiger crouches then runs in S3, lunges with t_5 in S5", () => {
  assert.equal(tigerAt(S.S3.start + 0.1).pose, "t_2");
  assert.ok(["t_3", "t_4"].includes(tigerAt(S.S3.end - 0.2).pose));
  assert.equal(tigerAt(S.S5.start + 0.8).pose, "t_5");
  assert.ok(tigerAt(S.S5.start + 0.8).toward > tigerAt(S.S5.start + 0.4).toward);
});

test("everything holds still after the freeze", () => {
  const f = timing.freeze;
  assert.deepEqual(tigerAt(f + 0.3), tigerAt(f));
  assert.deepEqual(grandmaAt(f + 0.5), grandmaAt(f));
});

test("rig is a pure function of t", () => {
  for (const t of [2.13, 4.71, 6.66]) {
    assert.deepEqual(grandmaAt(t), grandmaAt(t));
    assert.deepEqual(tigerAt(t), tigerAt(t));
  }
});

test("feet land: squash on contact, lift mid-stride", () => {
  const st = grandmaAt(2.0);
  assert.ok(st.lift >= 0);
  let squashed = false, lifted = false;
  for (let t = 2.0; t < 2.5; t += 1 / 30) {
    const s = grandmaAt(t);
    if (s.sy < 0.98) squashed = true;
    if (s.lift > 5) lifted = true;
  }
  assert.ok(squashed && lifted);
});

test("running characters leave motion ghosts, crouching tiger does not", () => {
  assert.equal(grandmaAt(2.2).ghosts.length, 2);
  assert.equal(tigerAt(S.S3.start + 0.1).ghosts.length, 0);
});
