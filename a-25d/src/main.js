// Entry: build the scene once, then draw any frame purely from timeline time t.
import * as THREE from "three";
import timing from "../assets/timing.json" with { type: "json" };
import { createBackground, makeDepthSampler } from "./background.js";
import { createAtmosphere } from "./atmosphere.js";

const W = 1280, H = 720;

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function loadTex(src) {
  const tex = await new THREE.TextureLoader().loadAsync(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

async function build() {
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("stage"), antialias: true, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 100);

  const [colorTex, occTex, depthImg] = await Promise.all([
    loadTex("assets/bg/color.jpg"), loadTex("assets/bg/occluder.webp"), loadImage("assets/bg/depth_rg.png"),
  ]);
  const bg = createBackground(scene, { colorTex, occTex, depth: makeDepthSampler(depthImg) });
  const atmo = createAtmosphere(scene, bg);

  // camera state driven by the GSAP timeline (Task 6 replaces this with per-shot keys)
  const cam = { x: 0, y: 0, z: 0, fov: 40 };
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(cam, { z: 0, x: 0 }, { z: -1.2, x: 0.3, duration: timing.duration, ease: "none" }, 0);

  function renderAt(t) {
    tl.seek(t, false);
    camera.position.set(cam.x, cam.y, cam.z);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(cam.x * 0.5, cam.y, cam.z - 10);
    atmo.update(t);
    renderer.render(scene, camera);
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
