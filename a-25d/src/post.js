// Post: bloom on the brightest points, warm grade, vignette, seeded grain, freeze desaturation, fade to black.
import * as THREE from "three";

const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(fs, uniforms) {
  const m = new THREE.ShaderMaterial({ vertexShader: quadVS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { scene: s, mat: m };
}

export function createPost(renderer, W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  const bw = W / 4, bh = H / 4;
  const rtA = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const bright = pass(`uniform sampler2D tSrc; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114));
      gl_FragColor = vec4(c * smoothstep(0.55, 0.95, l), 1.0); }`, { tSrc: { value: null } });
  const blur = pass(`uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = vec3(0.0); float w[5]; w[0]=0.227; w[1]=0.195; w[2]=0.122; w[3]=0.054; w[4]=0.016;
      c += texture2D(tSrc, vUv).rgb * w[0];
      for (int i = 1; i < 5; i++) { c += texture2D(tSrc, vUv + dir * float(i)).rgb * w[i];
                                     c += texture2D(tSrc, vUv - dir * float(i)).rgb * w[i]; }
      gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
  const final = pass(`uniform sampler2D tScene; uniform sampler2D tBloom; varying vec2 vUv;
    uniform float sat, vig, fade, flash, grain, frame;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 7.13) * 43758.5453); }
    vec3 toSRGB(vec3 c){ c = max(c, 0.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec3 c = toSRGB(texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * 0.35);  // grade in display space
      c = c * vec3(1.03, 1.0, 0.95);                                   // warm sunset grade
      c = mix(vec3(0.5), c, 1.06);                                     // a touch of contrast
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, sat);                                        // freeze desaturation
      vec2 d = vUv - 0.5; d.x *= 1.25;
      c *= 1.0 - vig * smoothstep(0.25, 0.85, length(d) * 1.3);       // vignette
      c += (h(vUv * 1000.0) - 0.5) * 0.035 * grain;                    // film grain, seeded per frame
      c = mix(c, vec3(1.0, 0.97, 0.9), flash);
      c *= 1.0 - fade;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`, {
    tScene: { value: rt.texture }, tBloom: { value: rtA.texture },
    sat: { value: 1 }, vig: { value: 0.3 }, fade: { value: 0 }, flash: { value: 0 }, grain: { value: 1 }, frame: { value: 0 },
  });

  const draw = (p, target) => { renderer.setRenderTarget(target); renderer.render(p.scene, cam); };

  return {
    // fx: {sat, vig, fade, flash}; frame: integer frame index (grain seed); grainOn: boolean
    render(scene, camera, fx, frame, grainOn) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      bright.mat.uniforms.tSrc.value = rt.texture; draw(bright, rtA);
      blur.mat.uniforms.tSrc.value = rtA.texture; blur.mat.uniforms.dir.value.set(1 / bw, 0); draw(blur, rtB);
      blur.mat.uniforms.tSrc.value = rtB.texture; blur.mat.uniforms.dir.value.set(0, 1 / bh); draw(blur, rtA);
      const u = final.mat.uniforms;
      u.sat.value = fx.sat; u.vig.value = fx.vig; u.fade.value = fx.fade; u.flash.value = fx.flash;
      u.grain.value = grainOn ? 1 : 0; u.frame.value = frame;
      draw(final, null);
    },
  };
}
