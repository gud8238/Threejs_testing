// A cut-out character card: pose swap, squash/stretch, lean, contact shadow, motion ghosts, dust puffs.
import * as THREE from "three";

function radialTex(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SHADOW_TEX = () => radialTex("rgba(40,22,10,0.85)", "rgba(40,22,10,0)");
const DUST_TEX = () => radialTex("rgba(214,170,120,0.9)", "rgba(214,170,120,0)");

export function createCharacter(scene, { textures, meta, worldPerPx, bg, order }) {
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // origin at the feet
  const card = (opacity, ro) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: Object.values(textures)[0], transparent: true, depthTest: false, depthWrite: false, opacity }));
    m.renderOrder = ro;
    scene.add(m);
    return m;
  };
  const ghosts = [card(0.22, order - 2), card(0.1, order - 3)];
  const body = card(1, order);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: SHADOW_TEX(), transparent: true, depthTest: false, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = order - 4;
  scene.add(shadow);

  const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: DUST_TEX(), transparent: true, depthTest: false }));
  puff.renderOrder = order - 1;
  scene.add(puff);

  const tmp = new THREE.Vector3();
  function place(mesh, st, target) {
    const m = meta[st.pose];
    const foot = bg.groundAt(st.x, st.y);
    foot.y += st.lift * bg.pxWorldAtGround(st.y);
    if (st.toward > 0 && target) foot.lerp(target, st.toward);
    mesh.position.copy(foot);
    mesh.material.map = textures[st.pose];
    mesh.scale.set(m.w * worldPerPx * (st.sx ?? 1), m.h * worldPerPx * (st.sy ?? 1), 1);
    mesh.rotation.z = st.lean ?? 0;
    return foot;
  }

  return {
    update(st, target) {
      const all = [body, ...ghosts, shadow, puff];
      if (!st.visible) {
        all.forEach((o) => (o.visible = false));
        return;
      }
      body.visible = true;
      place(body, st, target);

      ghosts.forEach((g, i) => {
        const gs = st.ghosts[i];
        g.visible = !!gs;
        if (gs) {
          place(g, { ...st, ...gs, sx: st.sx, sy: st.sy }, target);
          g.material.opacity = gs.alpha;
        }
      });

      const w = meta[st.pose].w * worldPerPx;
      const ground = bg.groundAt(st.x, st.y);
      if (st.toward > 0 && target) ground.lerp(tmp.copy(target).setY(ground.y), st.toward * 0.3);
      shadow.visible = st.shadow > 0.01;
      shadow.position.copy(ground).add(new THREE.Vector3(0, 0.01, 0));
      shadow.scale.set(w * 0.75, w * 0.22, 1);
      shadow.material.opacity = Math.max(0, st.shadow);

      const p = st.puff;
      puff.visible = !!p && p.age < 0.35;
      if (puff.visible) {
        const a = p.age / 0.35;
        puff.position.copy(bg.groundAt(p.x, p.y));
        puff.position.y += w * 0.06;
        const s = w * (0.18 + 0.35 * a);
        puff.scale.set(s, s * 0.6, 1);
        puff.material.opacity = 0.55 * (1 - a);
      }
    },
  };
}
