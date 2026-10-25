// The Biome Frontier in 3D: a misty rainforest with a waterfall (west), a red sandstone canyon with
// fossils in its cliffs (north, across the river and the rope bridge) and a turquoise coral coast with a
// research pier (east). The hub's explorer, camera and HUD drive the player; this scene renders the
// place, registers its targets and calls onExit at the trail gate.
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Game, Target, TargetKind } from "../../game/state";
import type { QualityPlan } from "../../settings";
import { addWind, glowTexture, useModel, useTiles, wind } from "../../scene/assets";
import type { BiomeFrontierProps } from "./types";
import {
  BOARDS, BRIDGE, CLIFF, CORALS, CRITTERS, DIG, DIG_STAND, EXIT, GATE, PALMS, PIER, POOL, ROCKS, SIGNPOST, STATION, TREES,
  groundY, keepClear, landHeight, regionWeights, shoreX, trailDist, waterDist, WORLD_R,
} from "./layout";
import { useSurvey } from "./store";
import type { ExpeditionProps } from "../../block";
import { defaultExpedition } from "../../expedition/content";
import { Creatures } from "./Creatures";
import { DigBlock } from "./DigBlock";
import { FrontierInsects } from "../../scene/Insects";

export const KIND = {
  dig: "biome-frontier:dig",
  station: "biome-frontier:station",
  sign: "biome-frontier:sign",
  exit: "biome-frontier:exit",
} as const;

/** What the scene asks the hub to show (the activity opens itself from the survey store). */
export interface BiomeCard {
  kind: string;
  ref?: string | number;
}

const MAP = 150;
const SUN_DIR = new THREE.Vector3(22, 30, -26).normalize();

// ------------------------------------------------------------------ helpers
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mat4(x: number, y: number, z: number, ry: number, s: number, sy = s) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
  return m;
}

interface Part {
  name: string;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/** Meshes under a named node (or the whole scene), baked relative to that node, for instancing. */
function meshesUnder(scene: THREE.Object3D, node?: string): Part[] {
  scene.updateMatrixWorld(true);
  const root = node ? scene.getObjectByName(node) : scene;
  if (!root) return [];
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out: Part[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    out.push({ name: m.name, geo, mat: m.material as THREE.Material });
  });
  return out;
}

/** A copy of a named node, placed (the node's own offset removed). */
function placedClone(scene: THREE.Object3D, node: string) {
  const src = scene.getObjectByName(node);
  const g = new THREE.Group();
  if (!src) return g;
  const c = src.clone(true);
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  c.scale.set(1, 1, 1);
  g.add(c);
  return g;
}

function Instanced({ parts, matrices, shadows }: { parts: Part[]; matrices: THREE.Matrix4[]; shadows?: boolean }) {
  const meshes = useMemo(
    () =>
      parts.map((p) => {
        const im = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, matrices.length));
        matrices.forEach((m, i) => im.setMatrixAt(i, m));
        im.count = matrices.length;
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = !!shadows;
        im.receiveShadow = true;
        im.frustumCulled = false;
        return im;
      }),
    [parts, matrices, shadows],
  );
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

/** Camera and explorer positions, updated every frame: foliage between them dissolves (dithered) so the
 *  explorer is never lost behind a giant trunk or leaf. Shadows are unaffected. */
const seeThrough = { cam: { value: new THREE.Vector3() }, player: { value: new THREE.Vector3() } };

function addSeeThrough(mat: THREE.Material) {
  const m = mat as THREE.Material & { userData: { bfSee?: boolean } };
  if (m.userData.bfSee) return;
  m.userData.bfSee = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uSeeCam = seeThrough.cam;
    sh.uniforms.uSeePlayer = seeThrough.player;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeeW;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vSeeW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vSeeW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSeeCam;\nuniform vec3 uSeePlayer;\nvarying vec3 vSeeW;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        {
          vec3 sd = uSeePlayer - uSeeCam;
          float sl = length(sd);
          vec3 sn = sd / max(sl, 0.001);
          float st = dot(vSeeW - uSeeCam, sn);
          if (st > 0.0 && st < sl - 0.6) {
            float sr = length(vSeeW - uSeeCam - sn * st);
            float rad = 1.2 + 1.2 * clamp(st / sl, 0.0, 1.0);
            if (sr < rad) {
              vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
              float dith = (mod(q.x + q.y * 2.0, 4.0) + mod(q.y, 2.0) * 0.5 + 0.25) / 4.5;
              if ((1.0 - sr / rad) * 1.6 > dith) discard;
            }
          }
        }`,
      );
  };
  m.customProgramCacheKey = () => "bf-see-" + m.uuid;
  m.needsUpdate = true;
}

function SeeThroughTracker({ game }: { game: Game }) {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    seeThrough.cam.value.copy(camera.position);
    seeThrough.player.value.set(game.me.x, game.me.y + 0.9, game.me.z);
  });
  return null;
}

function windOn(scene: THREE.Object3D, re: RegExp, strength: number) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && re.test(m.name + " " + (m.material as THREE.Material).name)) addWind(m.material as THREE.Material, strength);
  });
}

function Clickable({ children, onPick }: { children: React.ReactNode; onPick: () => void }) {
  const gl = useThree((s) => s.gl);
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onPointerOver={() => (gl.domElement.style.cursor = "pointer")}
      onPointerOut={() => (gl.domElement.style.cursor = "")}
    >
      {children}
    </group>
  );
}

// ------------------------------------------------------------------ sky, light, haze
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#4f97cf") },
          mid: { value: new THREE.Color("#a7d2e4") },
          low: { value: new THREE.Color("#f4e6c4") },
          sun: { value: SUN_DIR.clone() },
        },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sun; varying vec3 vP;
          void main(){ float h = vP.y; vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, h)); c = mix(c, top, smoothstep(0.22, 0.85, h));
          float s = max(dot(normalize(vP), sun), 0.0);
          c += vec3(1.0, 0.86, 0.6) * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.9);
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[320, 32, 16]} />
    </mesh>
  );
}

function Haze() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new THREE.Fog("#cfe3e2", 34, 125);
    return () => {
      scene.fog = prev;
    };
  }, [scene]);
  return null;
}

function Lights({ plan }: { plan: QualityPlan }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(0, 0, -2);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -38;
    c.right = 38;
    c.top = 38;
    c.bottom = -38;
    c.near = 1;
    c.far = 140;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.05;
  }, []);
  return (
    <>
      <hemisphereLight args={["#e6f2ff", "#5d7a3a", 1.2]} />
      <directionalLight
        ref={sun}
        position={[SUN_DIR.x * 60, SUN_DIR.y * 60, SUN_DIR.z * 60 - 2]}
        intensity={2.7}
        color="#fff0d2"
        castShadow={plan.shadows}
        shadow-mapSize-width={plan.shadowSize}
        shadow-mapSize-height={plan.shadowSize}
        shadow-radius={4}
      />
      <directionalLight position={[-20, 12, 30]} intensity={0.5} color="#cfe6ff" />
      <ambientLight intensity={0.14} />
    </>
  );
}

// ------------------------------------------------------------------ terrain
function Terrain({ props, game }: { props: BiomeFrontierProps; game: Game }) {
  const tx = props.textures;
  const [jungle, sand, canyon] = useTiles([tx.jungleFloor, tx.sand, tx.canyonFloor]);
  const geo = useMemo(() => {
    const N = 230;
    const g = new THREE.PlaneGeometry(MAP, MAP, N, N);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const w = new Float32Array(pos.count * 4);
    const wet = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const wd = waterDist(x, z);
      const r = Math.hypot(x, z);
      let y = landHeight(x, z);
      if (wd > 1.5) y += (Math.sin(x * 0.9 + z * 0.4) * Math.sin(z * 0.7 - x * 0.3)) * 0.04 * Math.min(1, (wd - 1.5) / 2);
      pos.setY(i, y);
      let [f, c, s] = regionWeights(x, z);
      if (wd < 0) {
        // river and pool beds: dark mud; the sea floor: sand
        const sea = x > shoreX(z) - 1 ? 1 : 0;
        s = sea ? 1 : 0.35;
        f = sea ? 0 : 0.65;
        c = 0;
      }
      const tr = wd > 0 && r < WORLD_R + 1 ? Math.max(0, 1 - Math.max(0, trailDist(x, z) - 0.55) / 0.7) * (1 - s) : 0;
      w[i * 4] = f;
      w[i * 4 + 1] = c;
      w[i * 4 + 2] = s;
      w[i * 4 + 3] = tr;
      wet[i] = Math.max(0, Math.min(1, 1 - wd / 1.8));
    }
    g.setAttribute("aW", new THREE.BufferAttribute(w, 4));
    g.setAttribute("aWet", new THREE.BufferAttribute(wet, 1));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: jungle, roughness: 0.95, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.sandMap = { value: sand };
      sh.uniforms.canyonMap = { value: canyon };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 aW;\nattribute float aWet;\nvarying vec4 vBfW;\nvarying float vBfWet;\nvarying vec3 vBfP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBfW = aW; vBfWet = aWet; vBfP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D sandMap;\nuniform sampler2D canyonMap;\nvarying vec4 vBfW;\nvarying float vBfWet;\nvarying vec3 vBfP;")
        .replace(
          "#include <map_fragment>",
          `vec3 bfJ = texture2D(map, vBfP.xz / 5.0).rgb;
           vec3 bfJ2 = texture2D(map, vBfP.xz / 19.0 + vec2(0.31, 0.57)).rgb;
           bfJ = mix(bfJ, bfJ2 * vec3(1.05, 1.08, 0.9), 0.35);
           vec3 bfS = texture2D(sandMap, vBfP.xz / 6.0).rgb;
           vec3 bfC = texture2D(canyonMap, vBfP.xz / 6.5).rgb;
           vec3 bfC2 = texture2D(canyonMap, vBfP.xz / 23.0 + vec2(0.4, 0.2)).rgb;
           bfC = mix(bfC, bfC2, 0.35);
           vec3 bfT = mix(texture2D(canyonMap, vBfP.xz / 4.0).rgb * vec3(0.62, 0.52, 0.42), bfJ, 0.4);
           vec4 w = vBfW;
           // break up the region edges with texture noise so they read as painted, not as lines
           float bfN = texture2D(sandMap, vBfP.xz / 27.0).r - 0.55;
           w.y = clamp(w.y + bfN * 0.6 * w.y * (1.0 - w.y) * 4.0, 0.0, 1.0);
           w.z = clamp(w.z + bfN * 0.6 * w.z * (1.0 - w.z) * 4.0, 0.0, 1.0);
           float tot = max(0.001, w.x + w.y + w.z);
           vec3 bfCol = (bfJ * w.x + bfC * w.y + bfS * w.z) / tot;
           bfCol = mix(bfCol, bfT, smoothstep(0.2, 0.8, w.w + bfN * 0.4));
           bfCol *= mix(1.0, 0.62, vBfWet);
           diffuseColor.rgb *= bfCol;`,
        );
    };
    return m;
  }, [jungle, sand, canyon]);
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      geometry={geo}
      material={mat}
      receiveShadow
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current;
        down.current = null;
        if (!d || game.mode !== "play" || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
        game.walkTo = { x: e.point.x, z: e.point.z };
      }}
    />
  );
}

// ------------------------------------------------------------------ water: sea, river, pool (one animated surface)
const WATER_Y = -0.12;

function depthTexture() {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * MAP;
      const z = (j / (N - 1) - 0.5) * MAP;
      const d = Math.max(0, WATER_Y - landHeight(x, z));
      const o = (j * N + i) * 4;
      data[o] = Math.round(Math.min(1, d / 2.6) * 255);
      data[o + 1] = x > shoreX(z) - 2 ? 255 : 0; // sea (turquoise) vs fresh water (green-blue)
      data[o + 2] = 0;
      data[o + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function Water({ props }: { props: BiomeFrontierProps }) {
  const [nrm] = useTiles([props.textures.waterNormal]);
  const mat = useMemo(() => {
    const n = nrm.clone();
    n.colorSpace = THREE.NoColorSpace;
    n.wrapS = n.wrapT = THREE.RepeatWrapping;
    n.needsUpdate = true;
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uNormal: { value: null },
          uDepth: { value: null },
          uSun: { value: SUN_DIR.clone() },
          uMap: { value: MAP },
        },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime; uniform sampler2D uNormal; uniform sampler2D uDepth; uniform vec3 uSun; uniform float uMap;
        varying vec3 vW;
        void main(){
          vec2 uv = vW.xz / uMap + 0.5;
          vec4 dd = texture2D(uDepth, clamp(uv, 0.0, 1.0));
          float outside = step(1.0, max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0);
          float d = mix(dd.r, 1.0, outside);
          float sea = mix(dd.g, 1.0, outside);
          vec3 n1 = texture2D(uNormal, vW.xz / 9.0 + vec2(uTime * 0.018, uTime * 0.011)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormal, vW.xz / 5.3 - vec2(uTime * 0.013, -uTime * 0.02)).xyz * 2.0 - 1.0;
          vec3 n = normalize(vec3(n1.x + n2.x, 2.2, n1.y + n2.y));
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
          vec3 shallowSea = vec3(0.12, 0.80, 0.78);
          vec3 deepSea = vec3(0.03, 0.36, 0.62);
          vec3 shallowFresh = vec3(0.32, 0.62, 0.52);
          vec3 deepFresh = vec3(0.10, 0.34, 0.36);
          vec3 shallow = mix(shallowFresh, shallowSea, sea);
          vec3 deep = mix(deepFresh, deepSea, sea);
          vec3 col = mix(shallow, deep, smoothstep(0.02, 0.75, d));
          col = mix(col, vec3(0.55, 0.78, 0.9), fres * 0.35);
          vec3 H = normalize(uSun + V);
          float spec = pow(max(dot(n, H), 0.0), 140.0) * 2.2;
          col += vec3(1.0, 0.94, 0.8) * spec;
          // foam: a moving lace where the water is shallow
          float lace = texture2D(uNormal, vW.xz / 2.2 + vec2(uTime * 0.05, 0.0)).r;
          float shoreFoam = (1.0 - smoothstep(0.0, 0.035, d)) * mix(0.35, 1.0, sea) * smoothstep(0.35, 0.65, lace + 0.25 * sin(uTime * 1.3 + vW.x * 0.6 + vW.z * 0.4));
          col = mix(col, vec3(0.97, 0.99, 1.0), shoreFoam * 0.85);
          float a = mix(0.62, 0.95, smoothstep(0.0, 0.6, d));
          a = max(a, shoreFoam * 0.9);
          // the colours above are picked in sRGB; the renderer works in linear light
          gl_FragColor = vec4(pow(col, vec3(2.2)), a);
          #include <fog_fragment>
        }`,
    });
  }, [nrm]);
  const depth = useMemo(depthTexture, []);
  useEffect(() => {
    const n = nrm.clone();
    n.colorSpace = THREE.NoColorSpace;
    n.wrapS = n.wrapT = THREE.RepeatWrapping;
    n.needsUpdate = true;
    mat.uniforms.uNormal.value = n;
    mat.uniforms.uDepth.value = depth;
  }, [mat, nrm, depth]);
  useFrame(() => {
    mat.uniforms.uTime.value = wind.value;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]} material={mat} renderOrder={2}>
      <planeGeometry args={[700, 700, 1, 1]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ waterfall: falling sheet, foam, mist
const LIP = (() => {
  const s = Math.sin(CLIFF.ry);
  const c = Math.cos(CLIFF.ry);
  return { x: CLIFF.x + s * 3.1, y: 7.3, z: CLIFF.z + c * 3.1, ry: CLIFF.ry };
})();

function Waterfall({ plan }: { plan: QualityPlan }) {
  const fall = useMemo(() => {
    const W = 3.2;
    const segY = 24;
    const g = new THREE.PlaneGeometry(W, 1, 6, segY);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = 0.5 - p.getY(i); // 0 at the lip .. 1 at the pool
      const y = LIP.y - t * (LIP.y + 0.25);
      const out = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 1.3 + 0.25;
      const x = p.getX(i) * (1 + t * 0.35);
      p.setXYZ(i, x, y, out - Math.abs(x) * 0.12);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
        vertexShader: `#include <fog_pars_vertex>
          varying vec2 vUv;
          void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
          }`,
        fragmentShader: `#include <fog_pars_fragment>
          uniform float uTime; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){
            float t = 1.0 - vUv.y;
            float s = n(vec2(vUv.x * 14.0, t * 3.0 - uTime * 2.6)) * 0.6 + n(vec2(vUv.x * 33.0, t * 7.0 - uTime * 4.1)) * 0.4;
            float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
            vec3 c = mix(vec3(0.55, 0.78, 0.82), vec3(0.97, 1.0, 1.0), smoothstep(0.35, 0.8, s));
            float a = (0.45 + 0.5 * smoothstep(0.3, 0.75, s)) * edge;
            a *= smoothstep(0.0, 0.05, t);
            gl_FragColor = vec4(pow(c, vec3(2.2)), a);
            #include <fog_fragment>
          }`,
      }),
    [],
  );
  const foamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
            float k = n(vec2(a * 4.0, r * 6.0 - uTime * 1.5)) * 0.6 + n(vec2(a * 9.0, r * 12.0 - uTime * 2.2)) * 0.4;
            float alpha = (1.0 - smoothstep(0.3, 1.0, r)) * smoothstep(0.35, 0.7, k);
            gl_FragColor = vec4(vec3(0.97, 1.0, 1.0), alpha * 0.85); }`,
      }),
    [],
  );
  const mistCount = plan.extras ? 70 : 28;
  const mist = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(mistCount * 3), 3));
    const R = rng(5);
    const seeds = Array.from({ length: mistCount }, () => ({ a: R() * 6.28, r: R() * 1.8, s: 0.25 + R() * 0.45, p: R() }));
    return { g, seeds };
  }, [mistCount]);
  const base = useMemo(() => {
    const s = Math.sin(LIP.ry);
    const c = Math.cos(LIP.ry);
    return new THREE.Vector3(LIP.x + s * 1.5, WATER_Y + 0.02, LIP.z + c * 1.5);
  }, []);
  useFrame(() => {
    const t = wind.value;
    mat.uniforms.uTime.value = t;
    foamMat.uniforms.uTime.value = t;
    const a = mist.g.getAttribute("position") as THREE.BufferAttribute;
    mist.seeds.forEach((m, i) => {
      const k = (t * m.s * 0.35 + m.p) % 1;
      const rr = m.r + k * 2.2;
      a.setXYZ(i, base.x + Math.cos(m.a) * rr, base.y + 0.3 + k * 3.2, base.z + Math.sin(m.a) * rr);
    });
    a.needsUpdate = true;
  });
  return (
    <>
      <mesh geometry={fall} material={mat} position={[LIP.x, 0, LIP.z]} rotation-y={LIP.ry} renderOrder={3} />
      <mesh material={foamMat} position={base} rotation-x={-Math.PI / 2} renderOrder={4}>
        <planeGeometry args={[4.6, 4.6]} />
      </mesh>
      <points geometry={mist.g} frustumCulled={false} renderOrder={6}>
        <pointsMaterial map={glowTexture()} size={2.6} sizeAttenuation transparent depthWrite={false} opacity={0.28} color="#eef8ff" fog />
      </points>
    </>
  );
}

// ------------------------------------------------------------------ set pieces
function Cliff({ url }: { url: string }) {
  const gltf = useModel(url);
  useMemo(() => windOn(gltf.scene, /leaves|plant/, 0.4), [gltf]);
  return <primitive object={gltf.scene} position={[CLIFF.x, -0.4, CLIFF.z]} rotation-y={CLIFF.ry} />;
}

function Rocks({ url }: { url: string }) {
  const gltf = useModel(url);
  const objs = useMemo(
    () =>
      ROCKS.map((r) => {
        const g = placedClone(gltf.scene, r.node);
        g.position.set(r.x, -0.15, r.z);
        g.rotation.y = r.ry;
        g.scale.setScalar(r.s || 1);
        return g;
      }),
    [gltf],
  );
  return (
    <>
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  );
}

function Single({ url, x, y = 0, z, ry, s = 1, windRe, onPick }: { url: string; x: number; y?: number; z: number; ry: number; s?: number; windRe?: RegExp; onPick?: () => void }) {
  const gltf = useModel(url);
  useMemo(() => windRe && windOn(gltf.scene, windRe, 0.35), [gltf, windRe]);
  const el = <primitive object={gltf.scene} position={[x, y, z]} rotation-y={ry} scale={s} />;
  return onPick ? <Clickable onPick={onPick}>{el}</Clickable> : el;
}

function Signs({ url, onSign }: { url: string; onSign: (biome: string) => void }) {
  const gltf = useModel(url);
  const post = useMemo(() => placedClone(gltf.scene, "signpost"), [gltf]);
  const boards = useMemo(() => BOARDS.map((b) => placedClone(gltf.scene, "board_" + b.key)), [gltf]);
  const grove = useMemo(() => placedClone(gltf.scene, "board_grove"), [gltf]);
  const traps = useMemo(() => CRITTERS.cameraTraps.map(() => placedClone(gltf.scene, "camera_trap")), [gltf]);
  return (
    <>
      <primitive object={post} position={[SIGNPOST.x, 0, SIGNPOST.z]} rotation-y={SIGNPOST.ry} />
      {BOARDS.map((b, i) => (
        <Clickable key={b.key} onPick={() => onSign(b.biome)}>
          <primitive object={boards[i]} position={[b.x, landHeight(b.x, b.z), b.z]} rotation-y={b.ry} />
        </Clickable>
      ))}
      <primitive object={grove} position={[GATE.x + 3.2, 0, GATE.z - 1.2]} rotation-y={-0.4} scale={0.9} />
      {CRITTERS.cameraTraps.map((c, i) => (
        <primitive key={i} object={traps[i]} position={[c.x, 0, c.z]} rotation-y={c.ry} />
      ))}
    </>
  );
}

function Corals({ url }: { url: string }) {
  const gltf = useModel(url);
  const groups = useMemo(
    () =>
      ["coral_brain", "coral_branch", "coral_fan", "coral_tubes"].map((node) => ({
        parts: meshesUnder(gltf.scene, node),
        matrices: CORALS.filter((c) => c.node === node).map((c) => mat4(c.x, landHeight(c.x, c.z) - 0.05, c.z, c.ry, c.s || 1)),
      })),
    [gltf],
  );
  return (
    <>
      {groups.map((g, i) => (
        <Instanced key={i} parts={g.parts} matrices={g.matrices} />
      ))}
    </>
  );
}

function Trees({ props, plan }: { props: BiomeFrontierProps; plan: QualityPlan }) {
  const tree = useModel(props.models.jungleTree);
  const palm = useModel(props.models.palm);
  const tp = useMemo(() => {
    const p = meshesUnder(tree.scene);
    p.forEach((x) => /leaves|vines/.test(x.name + x.mat.name) && addWind(x.mat, 0.05));
    p.forEach((x) => addSeeThrough(x.mat));
    return p;
  }, [tree]);
  const pp = useMemo(() => {
    const p = meshesUnder(palm.scene);
    p.forEach((x) => /fronds/.test(x.name + x.mat.name) && addWind(x.mat, 0.09));
    p.forEach((x) => addSeeThrough(x.mat));
    return p;
  }, [palm]);
  // the background ring: more giant trees on the hills beyond the walkable edge
  const ring = useMemo(() => {
    const R = rng(13);
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < (plan.grass < 600 ? 16 : 30); i++) {
      const a = Math.PI * 0.45 + R() * Math.PI * 1.35; // west, south and north-west
      const r = WORLD_R + 4 + R() * 14;
      const x = Math.cos(a) * r;
      const z = -Math.sin(a) * r;
      if (x > shoreX(z) - 8 || (z < -22 && x > -10)) continue;
      out.push(mat4(x, landHeight(x, z) - 0.2, z, R() * 6.28, 1.0 + R() * 0.5));
    }
    return out;
  }, [plan.grass]);
  const tm = useMemo(() => TREES.map((t) => mat4(t.x, landHeight(t.x, t.z) - 0.1, t.z, t.ry, t.s || 1)).concat(ring), [ring]);
  const pm = useMemo(() => PALMS.map((t) => mat4(t.x, landHeight(t.x, t.z) - 0.05, t.z, t.ry, t.s || 1)), []);
  return (
    <>
      <Instanced parts={tp} matrices={tm} shadows={plan.shadows} />
      <Instanced parts={pp} matrices={pm} shadows={plan.shadows} />
    </>
  );
}

// ------------------------------------------------------------------ ground cover: giant leaves, ferns, grass
function GroundCover({ props, plan }: { props: BiomeFrontierProps; plan: QualityPlan }) {
  const leaves = useModel(props.models.giantLeaves);
  const fern = useModel(props.models.fern);
  const grass = useModel(props.models.grassTuft);
  const parts = useMemo(() => {
    const v = ["bigleaf_banana", "bigleaf_ear", "bigleaf_sprout"].map((n) => meshesUnder(leaves.scene, n));
    v.flat().forEach((p) => {
      addWind(p.mat, /leaves/.test(p.name + p.mat.name) ? 0.35 : 0.1);
      addSeeThrough(p.mat);
    });
    const f = meshesUnder(fern.scene);
    const g = meshesUnder(grass.scene);
    // the grove's foliage cards, re-tinted for a lusher, wetter green
    f.forEach((p) => {
      const m = (p.mat as THREE.MeshStandardMaterial).clone();
      m.color.setRGB(1.2, 1.45, 1.15);
      addWind(m, 1);
      p.mat = m;
    });
    const gd = g.map((p) => {
      const m = (p.mat as THREE.MeshStandardMaterial).clone();
      m.color.setRGB(1.5, 1.75, 1.2);
      addWind(m, 1);
      return { ...p, mat: m };
    });
    const dry = g.map((p) => {
      const m = (p.mat as THREE.MeshStandardMaterial).clone();
      m.color.setRGB(2.0, 1.45, 0.75); // sun-dried canyon grass
      addWind(m, 1);
      return { ...p, mat: m };
    });
    return { v, f, g: gd, dry };
  }, [leaves, fern, grass]);
  const layout = useMemo(() => {
    const R = rng(42);
    const big: THREE.Matrix4[][] = [[], [], []];
    const ferns: THREE.Matrix4[] = [];
    const tufts: THREE.Matrix4[] = [];
    const dry: THREE.Matrix4[] = [];
    const nBig = Math.round(plan.ferns * 0.9);
    let guard = 0;
    // giant leaves: thick in the rainforest, around tree roots, along the river and the pool
    const anchors = TREES.map((t) => ({ x: t.x, z: t.z, r: 2.6 * (t.s || 1) })).concat([{ x: POOL.x, z: POOL.z, r: POOL.r + 1.6 }]);
    while (big[0].length + big[1].length + big[2].length < nBig && guard++ < nBig * 20) {
      let x: number;
      let z: number;
      if (R() < 0.5) {
        const an = anchors[Math.floor(R() * anchors.length)];
        const a = R() * 6.28;
        x = an.x + Math.sin(a) * an.r * (0.9 + R() * 0.7);
        z = an.z + Math.cos(a) * an.r * (0.9 + R() * 0.7);
      } else {
        x = -32 + R() * 34;
        z = -26 + R() * 50;
      }
      const w = regionWeights(x, z);
      if (w[0] < 0.75 || Math.hypot(x, z) > WORLD_R + 8 || keepClear(x, z, -0.6) || waterDist(x, z) < 0.6) continue;
      const v = R() < 0.4 ? 0 : R() < 0.6 ? 1 : 2;
      big[v].push(mat4(x, landHeight(x, z) - 0.05, z, R() * 6.28, 0.8 + R() * 0.6));
    }
    guard = 0;
    while (ferns.length < plan.ferns && guard++ < plan.ferns * 20) {
      const x = -34 + R() * 52;
      const z = -26 + R() * 52;
      const w = regionWeights(x, z);
      if (w[0] < 0.6 || Math.hypot(x, z) > WORLD_R + 6 || keepClear(x, z, -1.0) || waterDist(x, z) < 0.3) continue;
      ferns.push(mat4(x, landHeight(x, z), z, R() * 6.28, 0.9 + R() * 0.9));
    }
    guard = 0;
    const nG = plan.grass;
    while (tufts.length + dry.length < nG && guard++ < nG * 8) {
      const x = -34 + R() * 66;
      const z = -30 + R() * 60;
      if (Math.hypot(x, z) > WORLD_R + 4 || waterDist(x, z) < 0.4 || trailDist(x, z) < 0.9) continue;
      const w = regionWeights(x, z);
      const s = 0.6 + R() * 0.8;
      if (w[1] > 0.6) {
        if (R() < 0.35) dry.push(mat4(x, landHeight(x, z), z, R() * 6.28, s * 0.9, s * 0.7));
      } else if (w[2] > 0.6) {
        if (R() < 0.15) tufts.push(mat4(x, 0, z, R() * 6.28, s, s * 0.8));
      } else tufts.push(mat4(x, landHeight(x, z), z, R() * 6.28, s * 1.2, s));
    }
    return { big, ferns, tufts, dry };
  }, [plan.ferns, plan.grass]);
  return (
    <>
      {parts.v.map((p, i) => (
        <Instanced key={i} parts={p} matrices={layout.big[i]} shadows={plan.shadows && plan.shadowSize > 1024} />
      ))}
      <Instanced parts={parts.f} matrices={layout.ferns} />
      <Instanced parts={parts.g} matrices={layout.tufts} />
      <Instanced parts={parts.dry} matrices={layout.dry} />
    </>
  );
}

// ------------------------------------------------------------------ the other saguaros (decor; the flowering one is a creature)
function Saguaros({ url }: { url: string }) {
  const sag = useModel(url);
  const parts = useMemo(() => meshesUnder(sag.scene).filter((p) => !/flower/.test(p.name)), [sag]);
  const mats = useMemo(() => CRITTERS.saguaro.slice(1).map((s) => mat4(s.x, landHeight(s.x, s.z) - 0.05, s.z, s.ry, s.s)), []);
  return <Instanced parts={parts} matrices={mats} shadows />;
}

// ------------------------------------------------------------------ atmosphere
function LightShafts() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "rgba(255,240,200,0)");
    v.addColorStop(0.35, "rgba(255,240,200,0.9)");
    v.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = "destination-in";
    const h = g.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, "rgba(0,0,0,0)");
    h.addColorStop(0.5, "rgba(0,0,0,1)");
    h.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = h;
    g.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  // through the rainforest canopy and over the sea
  const shafts = useMemo(
    () => [
      { x: -12, z: 2, w: 2.2, o: 0.08 },
      { x: -8, z: -4, w: 1.4, o: 0.07 },
      { x: -16, z: 8, w: 2.8, o: 0.06 },
      { x: 22, z: -6, w: 4.0, o: 0.07 },
      { x: 27, z: 4, w: 3.2, o: 0.06 },
    ],
    [],
  );
  const tilt = Math.atan2(Math.hypot(SUN_DIR.x, SUN_DIR.z), SUN_DIR.y);
  const yaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    refs.current.forEach((m, i) => {
      if (m) (m.material as THREE.MeshBasicMaterial).opacity = shafts[i].o * (0.75 + 0.25 * Math.sin(wind.value * 0.4 + i * 1.7));
    });
  });
  return (
    <>
      {shafts.map((s, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[s.x, 8, s.z]} rotation={new THREE.Euler(tilt, yaw, 0, "YXZ")} renderOrder={5}>
          <planeGeometry args={[s.w, 22]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={s.o} fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/** Pollen and spray drifting in the light: green-gold in the forest, white over the water. */
function Motes({ count = 90 }: { count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const seeds = useMemo(() => {
    const R = rng(7);
    return Array.from({ length: count }, () => ({ x: -26 + R() * 30, z: -20 + R() * 36, y: 0.5 + R() * 5, s: 0.15 + R() * 0.4, p: R() * 6.28 }));
  }, [count]);
  useFrame(() => {
    const t = wind.value;
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    seeds.forEach((s, i) => a.setXYZ(i, s.x + Math.sin(t * s.s + s.p) * 1.5, s.y + Math.sin(t * s.s * 1.7 + s.p) * 0.5, s.z + Math.cos(t * s.s * 0.8 + s.p) * 1.5));
    a.needsUpdate = true;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={glowTexture()} size={0.22} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#e9f7b0" />
    </points>
  );
}

// ------------------------------------------------------------------ targets + exit
function useTargets(game: Game) {
  useEffect(() => {
    const k = (s: string) => s as unknown as TargetKind;
    const own: Target[] = [];
    own.push({ key: "bf-dig", kind: k(KIND.dig), ref: "dig", x: DIG_STAND.x, z: DIG_STAND.z, reach: 2.6 });
    own.push({ key: "bf-station", kind: k(KIND.station), ref: "station", x: STATION.x - 0.5, z: STATION.z + 4.2, reach: 2.4 });
    for (const b of BOARDS) own.push({ key: "bf-sign-" + b.key, kind: k(KIND.sign), ref: b.biome, x: b.x + Math.sin(b.ry) * 1.0, z: b.z + Math.cos(b.ry) * 1.0, reach: 1.9 });
    game.targets = own;
    return () => {
      game.targets = game.targets.filter((t) => own.indexOf(t) < 0);
    };
  }, [game]);
}

function ExitWatch({ game, onExit }: { game: Game; onExit: () => void }) {
  const inside = useRef(true); // the explorer must step out first (no instant exit after a respawn)
  useFrame(() => {
    if (game.mode !== "play") return;
    const d = Math.hypot(game.me.x - EXIT.x, game.me.z - EXIT.z);
    if (d < EXIT.r && !inside.current) {
      inside.current = true;
      onExit();
    } else if (d > EXIT.r + 1.5) inside.current = false;
  });
  return null;
}

// ------------------------------------------------------------------ the district
export function Scene({ props, game, plan, onOpen, onExit, expedition }: {
  props: BiomeFrontierProps;
  game: Game;
  plan: QualityPlan;
  onOpen: (card: BiomeCard) => void;
  onExit: () => void;
  /** The first expedition's props (the Field Guide species live here as creatures). */
  expedition?: ExpeditionProps;
}) {
  const m = props.models;
  const open = useSurvey((s) => s.open);
  useTargets(game);
  const station = () => {
    open({ kind: "station" });
    onOpen({ kind: KIND.station });
  };
  return (
    <>
      <Haze />
      <SeeThroughTracker game={game} />
      <SkyDome />
      <Lights plan={plan} />
      <Terrain props={props} game={game} />
      <Water props={props} />
      <Cliff url={m.waterfallCliff} />
      <Waterfall plan={plan} />
      <Rocks url={m.canyonRocks} />
      <Single url={m.digSite} x={DIG.x} z={DIG.z} ry={DIG.ry} onPick={() => open({ kind: "dig" })} />
      {m.digBlock && (
        <Clickable onPick={() => useSurvey.getState().view == null && open({ kind: "dig" })}>
          <DigBlock url={m.digBlock} fossils={props.fossils || []} />
        </Clickable>
      )}
      <Single url={m.fieldStation} x={STATION.x} y={-0.05} z={STATION.z} ry={STATION.ry} windRe={/plant/} onPick={station} />
      <Single url={m.pier} x={PIER.x} z={PIER.z} ry={0} />
      <Single url={m.ropeBridge} x={BRIDGE.x} z={BRIDGE.z} ry={BRIDGE.ry} />
      <Single url={m.trailGate} x={GATE.x} z={GATE.z} ry={GATE.ry} windRe={/leaves/} />
      <Signs url={m.signposts} onSign={(biome) => open({ kind: "sign", biome })} />
      <Corals url={m.corals} />
      <Trees props={props} plan={plan} />
      <GroundCover props={props} plan={plan} />
      <Saguaros url={m.saguaro} />
      <Creatures species={(expedition || defaultExpedition).species} game={game} anemoneUrl={m.clownfish} />
      <FrontierInsects exp={expedition || defaultExpedition} game={game} ground={groundY} />
      <ExitWatch game={game} onExit={onExit} />
      {plan.extras && <LightShafts />}
      {plan.extras && <Motes />}
    </>
  );
}
