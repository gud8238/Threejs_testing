// B2 entry: everything is built from code, then each frame is drawn purely from timeline time t.
import * as THREE from "three";
import timing from "../assets/timing.json" with { type: "json" };
import { createTerrain } from "./terrain.js";
import { createFlora } from "./flora.js";
import { createSky } from "./sky.js";
import { createGrandma } from "./grandma.js";
import { createTiger } from "./tiger.js";
import { createPost } from "./post.js";
import { createDirector } from "./director.js";

const W = 1280, H = 720;
const params = new URLSearchParams(location.search);

async function build() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("stage"), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 600);
  const terrain = createTerrain(scene);
  createFlora(scene, terrain);
  const sky = createSky(scene);
  const grandma = createGrandma();
  const tiger = createTiger({ shells: +(params.get("shells") ?? 8) });
  scene.add(grandma.root, tiger.root);

  const tl = gsap.timeline({ paused: true });
  const director = createDirector({ tl, timing, terrain, sky, grandma, tiger, camera });
  const post = createPost(renderer, W, H);

  function renderAt(t) {
    tl.seek(t, false);
    director.apply(t);
    post.render(scene, camera, director.fx, Math.round(Math.min(t, timing.freeze) * 30), true);
  }

  await renderer.compileAsync(scene, camera);
  renderAt(0);
  const px = new Uint8Array(4);
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
  window.__timelines["main"] = tl;
  window.__render = renderAt;
}

build().then(() => window.__sceneDone(), (err) => { console.error(err); window.__sceneFail(err); });
