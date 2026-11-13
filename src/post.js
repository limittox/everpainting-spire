import * as THREE from 'three';

// Painterly post-process: scene -> Kuwahara (palette-knife smear) -> impasto relief + grade.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const KUWAHARA = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float sharp;      // 1: far-off things are painted with a fine knife instead of the broad one
uniform vec2 clip;        // the camera's near and far planes, to turn the depth buffer back into a distance
const float REACH = 11.0; // with "sharp" on: how far from the camera the knife is still at its full width
varying vec2 vUv;

// The same knife at its smallest: each stroke only two pixels across. It tidies edges but keeps the detail.
// (Both knives read the picture with textureLod: some pixels skip these loops, and an ordinary read inside a
// skipped loop cannot tell which mip level it wants, which the shader compiler complains about.)
vec3 fineKnife() {
  vec3 best = vec3(0.0); float minV = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 o = vec2(q == 1 || q == 2 ? 0.0 : -1.0, q >= 2 ? 0.0 : -1.0);
    vec3 m = vec3(0.0), s = vec3(0.0);
    for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++) {
      vec3 c = sqrt(max(textureLod(tDiffuse, vUv + (o + vec2(float(i), float(j))) * texel, 0.0).rgb, 0.0)); m += c; s += c * c;
    }
    m *= 0.25; s = abs(s * 0.25 - m * m);
    float v = s.r + s.g + s.b;
    if (v < minV) { minV = v; best = m; }
  }
  return best * best;
}

void main() {
  // The broad knife smears a fixed number of pixels, so it eats the detail of anything small on screen, which is
  // to say anything that is not close. With "sharp" on, the knife is a fixed size in the world instead: at its full
  // width out to REACH units from the camera, and narrower in proportion beyond that (half as wide at twice the
  // distance), so a tree keeps the same number of strokes however far off it stands. Once the knife is down to a
  // pixel or so, the fine knife takes over.
  float far = 0.0, k = 1.0;
  if (sharp > 0.5) {
    float z = textureLod(tDepth, vUv, 0.0).r * 2.0 - 1.0;
    float dist = 2.0 * clip.x * clip.y / (clip.y + clip.x - z * (clip.y - clip.x));
    float least = 1.3 / float(RADIUS), ratio = REACH / max(dist, 0.01);
    k = clamp(ratio, least, 1.0);
    far = smoothstep(least * 1.7, least, ratio);
  }
  vec2 tex = texel * k;
  vec3 fine = far > 0.001 ? fineKnife() : vec3(0.0);
  if (far > 0.999) { gl_FragColor = vec4(fine, 1.0); return; }
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = -RADIUS; j <= 0; j++) for (int i = -RADIUS; i <= 0; i++) {
    vec3 c = sqrt(max(textureLod(tDiffuse, vUv + vec2(float(i), float(j)) * tex, 0.0).rgb, 0.0)); m0 += c; s0 += c * c;
  }
  for (int j = -RADIUS; j <= 0; j++) for (int i = 0; i <= RADIUS; i++) {
    vec3 c = sqrt(max(textureLod(tDiffuse, vUv + vec2(float(i), float(j)) * tex, 0.0).rgb, 0.0)); m1 += c; s1 += c * c;
  }
  for (int j = 0; j <= RADIUS; j++) for (int i = 0; i <= RADIUS; i++) {
    vec3 c = sqrt(max(textureLod(tDiffuse, vUv + vec2(float(i), float(j)) * tex, 0.0).rgb, 0.0)); m2 += c; s2 += c * c;
  }
  for (int j = 0; j <= RADIUS; j++) for (int i = -RADIUS; i <= 0; i++) {
    vec3 c = sqrt(max(textureLod(tDiffuse, vUv + vec2(float(i), float(j)) * tex, 0.0).rgb, 0.0)); m3 += c; s3 += c * c;
  }
  float n = float((RADIUS + 1) * (RADIUS + 1));
  vec3 best = m0 / n; s0 = abs(s0 / n - best * best);
  float minV = s0.r + s0.g + s0.b;
  vec3 m; vec3 s; float v;
  m = m1 / n; s = abs(s1 / n - m * m); v = s.r + s.g + s.b; if (v < minV) { minV = v; best = m; }
  m = m2 / n; s = abs(s2 / n - m * m); v = s.r + s.g + s.b; if (v < minV) { minV = v; best = m; }
  m = m3 / n; s = abs(s3 / n - m * m); v = s.r + s.g + s.b; if (v < minV) { minV = v; best = m; }
  gl_FragColor = vec4(mix(best * best, fine, far), 1.0);
}
`;

// Glow: only the brightest paint (lanterns, sparks, sunlit cream) bleeds a little light into its surroundings.
const BRIGHT = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tDiffuse, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture2D(tDiffuse, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tDiffuse, vUv + texel * vec2(1.0, 1.0)).rgb;
  c = min(c * 0.25, vec3(4.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * smoothstep(0.92, 1.6, l), 1.0);
}
`;

const BLUR = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
  c += (texture2D(tDiffuse, vUv + dir * 1.3846).rgb + texture2D(tDiffuse, vUv - dir * 1.3846).rgb) * 0.3162162;
  c += (texture2D(tDiffuse, vUv + dir * 3.2308).rgb + texture2D(tDiffuse, vUv - dir * 3.2308).rgb) * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const FINAL = /* glsl */ `
precision highp float;
uniform sampler2D tK;
uniform sampler2D tBloom;
uniform float bloom;
uniform vec2 texel;
uniform float relief;
uniform float sat;
uniform float keepRed;    // 0..1: when the colour is gone, whatever is marked as blood keeps its own
uniform sampler2D tScene; // the scene as it was drawn: blood is the one thing in it that writes no alpha
uniform float flash;
uniform vec3 tint;
uniform sampler2D tDepth;
uniform vec2 clip;
uniform float ink;        // 0..1: how strongly outlines are drawn in pencil (the Underpainting)
varying vec2 vUv;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// one over the distance, up to a constant: it varies evenly across any flat surface, so it only "bends" where
// one thing ends and another begins, or where a surface turns a corner
float inv(vec2 uv) { return clip.y - textureLod(tDepth, uv, 0.0).r * (clip.y - clip.x); }
void main() {
  vec3 c = texture2D(tK, vUv).rgb;

  // impasto relief: treat the paint's own brightness as a height field and light it from the upper-left,
  // so ridges only appear where strokes actually meet (nothing is overlaid in screen space)
  vec2 e = texel * 1.5;
  float hL = lum(sqrt(texture2D(tK, vUv - vec2(e.x, 0.0)).rgb));
  float hR = lum(sqrt(texture2D(tK, vUv + vec2(e.x, 0.0)).rgb));
  float hD = lum(sqrt(texture2D(tK, vUv - vec2(0.0, e.y)).rgb));
  float hU = lum(sqrt(texture2D(tK, vUv + vec2(0.0, e.y)).rgb));
  vec2 grad = vec2(hR - hL, hU - hD) * 2.2;
  vec3 n = normalize(vec3(-grad * relief, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.6, 0.58));
  float shade = dot(n, L) - L.z;

  vec3 glow = texture2D(tBloom, vUv).rgb * bloom;
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c *= (1.0 + shade * 0.9) * tint;
  c = 1.0 - (1.0 - min(c, 1.0)) * (1.0 - min(pow(glow, vec3(1.0 / 2.2)), 1.0) * 0.55);   // screen the glow in, so it never clips

  if (ink > 0.001) {
    // a pencil line wherever the picture has an edge: outlines and creases from the depth, and a fainter
    // line where two flat tones meet
    vec2 o = texel * 1.3;
    float w = inv(vUv);
    float bend = abs(inv(vUv - vec2(o.x, 0.0)) + inv(vUv + vec2(o.x, 0.0)) - 2.0 * w) + abs(inv(vUv - vec2(0.0, o.y)) + inv(vUv + vec2(0.0, o.y)) - 2.0 * w);
    float line = smoothstep(0.012, 0.06, bend / max(w, 1e-4));
    line = max(line, smoothstep(0.07, 0.22, abs(hR - hL) + abs(hU - hD)) * 0.45);
    c = mix(c, vec3(0.2, 0.19, 0.25), line * ink * 0.8);
  }
  float l = lum(c);
  c = mix(vec3(l), c, sat);
  // (a mark, not a colour: a red tree is not blood, and a thin streak of blood far away is still blood)
  float blood = keepRed * clamp(1.0 - texture2D(tScene, vUv).a, 0.0, 1.0);
  c = mix(c, vec3(0.80, 0.02, 0.04) * (0.5 + 0.9 * l), blood);
  c = (c - 0.5) * 1.07 + 0.5;
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 0.38;                   // vignette
  c = mix(c, vec3(1.0, 0.97, 0.88), flash);
  gl_FragColor = vec4(c, 1.0);
}
`;

export class Painterly {
  constructor(renderer) {
    this.renderer = renderer;
    this.mode = 2; // 0 off, 1 painterly, 2 heavy impasto (the settings decide; this is only what it starts as)
    this.flash = 0;
    this.sat = 1.22;
    this.keepRed = 0;
    this.bloom = 1;
    this.ink = 0;           // 0..1: pencil outlines over the picture (the Underpainting is drawn, not painted)
    this.sharp = 0;         // 1: things keep their detail with distance (the knife narrows the further off it works)
    this.maxH = 1080;       // the picture is painted at no more than this many rows, then scaled to the window
    const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    // (the scene's depth is kept as a texture, so the knife can tell near from far)
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthTexture: new THREE.DepthTexture(4, 4) });
    this.rtK = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthBuffer: false });
    const mk = (radius) => new THREE.ShaderMaterial({
      defines: { RADIUS: radius },
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() }, sharp: { value: 0 }, clip: { value: new THREE.Vector2(0.3, 2600) } },
      vertexShader: VERT, fragmentShader: KUWAHARA, depthTest: false, depthWrite: false,
    });
    this.matK = [null, mk(3), mk(5)];
    this.rtB = [new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthBuffer: false }), new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthBuffer: false })];
    const pass = (frag, uniforms) => new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, ...uniforms }, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.matBright = pass(BRIGHT, { texel: { value: new THREE.Vector2() } });
    this.matBlur = pass(BLUR, { dir: { value: new THREE.Vector2() } });
    this.matFinal = new THREE.ShaderMaterial({
      uniforms: {
        tK: { value: null }, tScene: { value: null }, texel: { value: new THREE.Vector2() }, tBloom: { value: null }, bloom: { value: 1 },
        relief: { value: 1 }, sat: { value: 1.2 }, keepRed: { value: 0 }, flash: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) },
        tDepth: { value: null }, clip: { value: new THREE.Vector2(0.3, 2600) }, ink: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: FINAL, depthTest: false, depthWrite: false,
    });
    this.tint = this.matFinal.uniforms.tint.value;      // multiplied over the finished picture (time of day)
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.matFinal);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h) {
    // paint at a capped internal resolution so strokes stay chunky and the filter stays cheap
    const s = Math.min(1, this.maxH / h);
    this.iw = Math.max(2, Math.round(w * s)); this.ih = Math.max(2, Math.round(h * s));
    this.rtScene.setSize(this.iw, this.ih);
    this.rtK.setSize(this.iw, this.ih);
    this.bw = Math.max(2, this.iw >> 2); this.bh = Math.max(2, this.ih >> 2);
    this.rtB.forEach((rt) => rt.setSize(this.bw, this.bh));
    this.matFinal.uniforms.texel.value.set(1 / this.iw, 1 / this.ih);
  }

  /** Run only the palette-knife filter, from a texture into a target of the given size. */
  filter(texture, target, w, h) {
    const r = this.renderer, m = this.matK[1], prev = r.getRenderTarget();
    m.uniforms.tDiffuse.value = texture; m.uniforms.texel.value.set(1 / w, 1 / h);
    m.uniforms.sharp.value = 0;                      // a picture on an easel is painted with the broad knife throughout
    this.quad.material = m;
    r.setRenderTarget(target); r.render(this.qScene, this.qCam); r.setRenderTarget(prev);
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    let src = this.rtScene.texture;
    if (this.mode > 0) {
      const m = this.matK[this.mode];
      m.uniforms.tDiffuse.value = src;
      m.uniforms.tDepth.value = this.rtScene.depthTexture;
      m.uniforms.sharp.value = this.sharp; m.uniforms.clip.value.set(camera.near, camera.far);
      m.uniforms.texel.value.set(1 / this.iw, 1 / this.ih);
      this.quad.material = m;
      r.setRenderTarget(this.rtK);
      r.render(this.qScene, this.qCam);
      src = this.rtK.texture;
    }
    // glow: bright pass at quarter size, then two rounds of separable blur (a tight one and a wide one)
    const run = (mat, input, target) => { mat.uniforms.tDiffuse.value = input; this.quad.material = mat; r.setRenderTarget(target); r.render(this.qScene, this.qCam); };
    const [bA, bB] = this.rtB;
    this.matBright.uniforms.texel.value.set(1 / this.iw, 1 / this.ih);
    run(this.matBright, src, bA);
    for (const k of [1, 2.4]) {
      this.matBlur.uniforms.dir.value.set(k / this.bw, 0); run(this.matBlur, bA.texture, bB);
      this.matBlur.uniforms.dir.value.set(0, k / this.bh); run(this.matBlur, bB.texture, bA);
    }
    const u = this.matFinal.uniforms;
    u.tBloom.value = bA.texture; u.bloom.value = this.bloom;
    u.tK.value = src; u.tScene.value = this.rtScene.texture;
    u.relief.value = this.mode === 0 ? 0.0 : this.mode === 1 ? 1.0 : 1.5;
    u.sat.value = this.sat; u.keepRed.value = this.keepRed;
    u.tDepth.value = this.rtScene.depthTexture; u.clip.value.set(camera.near, camera.far); u.ink.value = this.ink;
    u.flash.value = this.flash;
    this.quad.material = this.matFinal;
    r.setRenderTarget(null);
    r.render(this.qScene, this.qCam);
  }
}
