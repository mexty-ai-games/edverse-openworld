// Small three.js helpers for the Chrono Quarter scene: seeded random, instancing of model parts,
// a dusk water shader, falling-water and light-beam materials.
import * as THREE from "three";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Part {
  name: string;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/** Meshes of a model (or of the nodes whose name / parent name passes `filter`), baked to world space. */
export function meshesOf(scene: THREE.Object3D, filter?: (name: string) => boolean): Part[] {
  scene.updateMatrixWorld(true);
  const out: Part[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (filter) {
      let ok = false;
      for (let p: THREE.Object3D | null = m; p && !ok; p = p.parent) ok = filter(p.name);
      if (!ok) return;
    }
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    out.push({ name: m.name, geo, mat: m.material as THREE.Material });
  });
  return out;
}

export function mat4(x: number, y: number, z: number, ry: number, s: number, sy = s) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
  return m;
}

export function makeInstanced(parts: Part[], matrices: THREE.Matrix4[], shadows: boolean): THREE.InstancedMesh[] {
  return parts.map((p) => {
    const im = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, matrices.length));
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = matrices.length;
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadows;
    im.receiveShadow = true;
    im.frustumCulled = false;
    return im;
  });
}

/** Warm dusk light used by the water and sky. */
export const SUN_DIR = new THREE.Vector3(-0.82, 0.4, -0.12).normalize();

/** Rippling water with a dusk sky reflection (fresnel), a sun glint and fog. Transparent. */
export function waterMaterial(opts: { deep: string; shallow: string; sky: string; opacity: number; scale: number }) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(opts.deep) },
      uShallow: { value: new THREE.Color(opts.shallow) },
      uSky: { value: new THREE.Color(opts.sky) },
      uSun: { value: SUN_DIR.clone() },
      uOpacity: { value: opts.opacity },
      uScale: { value: opts.scale },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun;
      uniform float uOpacity; uniform float uScale;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz * uScale;
        float t = uTime;
        vec2 g = vec2(0.0);
        g += vec2(cos(p.x * 1.7 + t * 1.3), cos(p.y * 1.3 - t * 1.1)) * 0.18;
        g += vec2(cos(p.x * 3.1 - p.y * 1.7 + t * 2.1), cos(p.y * 2.9 + p.x * 1.1 + t * 1.7)) * 0.09;
        g += vec2(cos(p.x * 6.3 + p.y * 4.1 - t * 3.3), cos(p.y * 5.7 - p.x * 3.9 + t * 2.9)) * 0.04;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, 0.35 + 0.25 * sin(p.x * 0.4 + p.y * 0.3));
        col = mix(col, uSky, clamp(fr * 0.9 + 0.15, 0.0, 1.0));
        vec3 h = normalize(uSun + v);
        float sp = pow(max(dot(n, h), 0.0), 160.0) * 2.4;
        col += vec3(1.0, 0.78, 0.5) * sp;
        float sparkle = smoothstep(0.985, 1.0, sin(p.x * 9.0 + t * 2.0) * sin(p.y * 8.0 - t * 1.6));
        col += vec3(1.0, 0.9, 0.7) * sparkle * 0.25;
        gl_FragColor = vec4(col, clamp(uOpacity + fr * 0.25, 0.0, 1.0));
        #include <fog_fragment>
      }`,
  });
}

/** Falling water sheets: bright streaks scrolling down (uv.v), soft and transparent. */
export function fallMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float u = vUv.x * 40.0;
        float s = sin(u * 3.1 + sin(u * 0.7) * 2.0) * 0.5 + 0.5;
        float flow = sin((vUv.y * 9.0 + uTime * 5.0) + u * 0.37) * 0.5 + 0.5;
        float a = 0.06 + 0.34 * pow(s * flow, 2.0);
        vec3 col = mix(vec3(0.55, 0.78, 0.86), vec3(1.0, 0.96, 0.9), s * flow);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
}

let beamTex: THREE.Texture | null = null;
/** A soft vertical light beam (bottom bright, fading up), drawn once. */
export function beamTexture(): THREE.Texture {
  if (beamTex) return beamTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  const v = g.createLinearGradient(0, 256, 0, 0);
  v.addColorStop(0, "rgba(255,230,160,0.95)");
  v.addColorStop(0.35, "rgba(255,210,120,0.45)");
  v.addColorStop(1, "rgba(255,200,100,0)");
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = "destination-in";
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, "rgba(0,0,0,0)");
  h.addColorStop(0.5, "rgba(0,0,0,1)");
  h.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  beamTex = new THREE.CanvasTexture(c);
  beamTex.colorSpace = THREE.SRGBColorSpace;
  return beamTex;
}

let petalTex: THREE.Texture | null = null;
/** A small pink petal sprite. */
export function petalTexture(): THREE.Texture {
  if (petalTex) return petalTex;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(255,190,214,1)";
  g.beginPath();
  g.ellipse(16, 16, 11, 6, 0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,226,236,1)";
  g.beginPath();
  g.ellipse(13, 13, 5, 2.5, 0.6, 0, Math.PI * 2);
  g.fill();
  petalTex = new THREE.CanvasTexture(c);
  petalTex.colorSpace = THREE.SRGBColorSpace;
  return petalTex;
}
