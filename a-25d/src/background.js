// Depth-displaced background: the painting is pushed along camera rays by its depth map,
// so it looks identical from the origin and gains real parallax when the camera moves.
import * as THREE from "three";

export const REF = { W: 1672, H: 941 }; // reference pixel space of the original background

export function makeDepthSampler(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const w = c.width, h = c.height;
  const at = (x, y) => {
    const i = (y * w + x) * 4;
    return (px[i] * 256 + px[i + 1]) / 65535;
  };
  // u, v in [0,1], v = 0 at the TOP of the image
  return (u, v) => {
    const fx = Math.min(Math.max(u * (w - 1), 0), w - 1);
    const fy = Math.min(Math.max(v * (h - 1), 0), h - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
    const tx = fx - x0, ty = fy - y0;
    const a = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
    const b = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

export function createBackground(scene, { colorTex, occTex, depth, D = 20, fov = 44, A = 10, gamma = 1 }) {
  const H = 2 * D * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const W = H * (REF.W / REF.H);
  const scaleOf = (d) => 1 / (1 + A * Math.pow(d, gamma));

  // reference pixel (x right, y down) -> point on the virtual plane at distance D
  const planePoint = (x, y) => new THREE.Vector3((x / REF.W - 0.5) * W, (0.5 - y / REF.H) * H, -D);
  const scaleAt = (x, y) => scaleOf(depth(x / REF.W, y / REF.H));
  const worldAt = (x, y) => planePoint(x, y).multiplyScalar(scaleAt(x, y));
  // world height of something that spans `px` reference pixels when standing at (x, y)
  const worldHeightFor = (px, x, y) => (px / REF.H) * H * scaleAt(x, y);

  // ground under the path, as a function of image row (sampled along the trail):
  // characters stand on this, not on whatever the painting shows at their feet (e.g. a bush)
  const GROUND = [[0, 0.06], [300, 0.088], [380, 0.106], [420, 0.128], [480, 0.133], [560, 0.153],
    [600, 0.157], [650, 0.167], [720, 0.189], [850, 0.275], [880, 0.287], [941, 0.33], [1100, 0.45]];
  const groundDepth = (y) => {
    for (let i = 1; i < GROUND.length; i++) {
      if (y <= GROUND[i][0]) {
        const [y0, d0] = GROUND[i - 1], [y1, d1] = GROUND[i];
        return d0 + (d1 - d0) * ((y - y0) / (y1 - y0));
      }
    }
    return GROUND[GROUND.length - 1][1];
  };
  const groundAt = (x, y) => planePoint(x, y).multiplyScalar(scaleOf(groundDepth(y)));
  const pxWorldAtGround = (y) => (H / REF.H) * scaleOf(groundDepth(y));

  const makeMesh = (tex, inset) => {
    const geo = new THREE.PlaneGeometry(W, H, 320, 180);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = 1 - uv.getY(i);
      const s = scaleOf(depth(u, v)) * inset;
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, -D * s);
    }
    geo.computeBoundingSphere();
    return geo;
  };

  const group = new THREE.Group();
  const bg = new THREE.Mesh(makeMesh(colorTex, 1), new THREE.MeshBasicMaterial({ map: colorTex, depthWrite: false }));
  bg.renderOrder = 0;
  const occ = new THREE.Mesh(
    makeMesh(occTex, 0.998),
    new THREE.MeshBasicMaterial({ map: occTex, transparent: true, depthTest: false, depthWrite: false }),
  );
  occ.renderOrder = 20;
  group.add(bg, occ);
  scene.add(group);
  return { group, occluder: occ, worldAt, scaleAt, worldHeightFor, groundAt, pxWorldAtGround, D, W, H };
}
