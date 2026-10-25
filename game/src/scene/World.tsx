import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { BlockProps } from "../block";
import type { Game } from "../game/state";
import type { QualityPlan } from "../settings";
import type { CardState } from "../ui/Cards";
import { ARENA, BOULDERS, FOREST, GARDEN_CENTRE, PLAZA_R, STALLS, TELESCOPE, TREE, colliders, keepClear, museumPoint, stallPoint } from "../game/layout";
import { addWind, glowTexture, useModel, useTiles, wind } from "./assets";

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

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * k, pz - az - dz * k);
}

const PATHS: [number, number, number, number, number][] = (() => {
  const out: [number, number, number, number, number][] = [];
  for (const st of STALLS) {
    const f = stallPoint(st, 0, 2.2);
    const a = Math.atan2(f.x, f.z);
    out.push([Math.sin(a) * (PLAZA_R + 0.4), Math.cos(a) * (PLAZA_R + 0.4), f.x, f.z, 1.0]);
  }
  out.push([0, PLAZA_R + 1.0, 0.6, 14, 1.1], [0.6, 14, -1.5, 24, 1.1]);
  out.push([0, -PLAZA_R, TREE.x, TREE.z + 3.5, 1.2]);
  // phase 3: trodden paths to the Explorers' Museum and to the community garden
  for (const end of [museumPoint(0, 6.4), { x: GARDEN_CENTRE.x - 1.6, z: GARDEN_CENTRE.z + 1.4 }]) {
    const a = Math.atan2(end.x, end.z);
    out.push([Math.sin(a) * (PLAZA_R + 0.4), Math.cos(a) * (PLAZA_R + 0.4), end.x, end.z, 0.9]);
  }
  return out;
})();

/** How much bare earth shows at a point (0 grass … 1 path), with soft, wobbly edges. */
export function pathMask(x: number, z: number): number {
  const wob = Math.sin(x * 0.9 + z * 0.3) * 0.25 + Math.sin(z * 1.7 - x * 0.6) * 0.18 + Math.sin(x * 3.1 + z * 2.3) * 0.08;
  let d = 9;
  for (const p of PATHS) d = Math.min(d, segDist(x, z, p[0], p[1], p[2], p[3]) - p[4]);
  const r = Math.hypot(x, z);
  d = Math.min(d, Math.abs(r - (PLAZA_R + 0.75)) - 0.55 - Math.max(0, Math.sin(Math.atan2(x, z) * 3) * 0.35));
  d = Math.min(d, Math.hypot(x - TREE.x, z - TREE.z) - 5.2);
  // the Bug Games arena: a trodden earth field in the west meadow
  d = Math.min(d, (Math.hypot((x - ARENA.x) / ARENA.rx, (z - ARENA.z) / ARENA.rz) - 1) * Math.min(ARENA.rx, ARENA.rz) + 0.4);
  return Math.max(0, Math.min(1, 0.5 - (d + wob * 0.6) * 0.9));
}

function maskTexture(): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i / N - 0.5) * 80;
      const z = (j / N - 0.5) * 80;
      const v = Math.round(pathMask(x, z) * 255);
      const o = (j * N + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Meshes of a model baked into world-ready geometries (one per mesh), for instancing. */
function meshesOf(scene: THREE.Object3D, filter?: (name: string) => boolean) {
  scene.updateMatrixWorld(true);
  const out: { name: string; geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (filter && !filter(m.name) && !filter(m.parent?.name || "")) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    out.push({ name: m.name, geo, mat: m.material as THREE.Material });
  });
  return out;
}

function Instanced({ parts, matrices, shadows }: { parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[]; matrices: THREE.Matrix4[]; shadows?: boolean }) {
  const meshes = useMemo(() => {
    return parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, matrices.length));
      matrices.forEach((m, i) => im.setMatrixAt(i, m));
      im.count = matrices.length;
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = !!shadows;
      im.receiveShadow = true;
      im.frustumCulled = false;
      return im;
    });
  }, [parts, matrices, shadows]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

function mat4(x: number, y: number, z: number, ry: number, s: number, sy = s) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
  return m;
}

// ------------------------------------------------------------------ sky & light
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color("#6f9fbf") }, mid: { value: new THREE.Color("#bcd2b4") }, low: { value: new THREE.Color("#f2d79c") } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(low, mid, smoothstep(-0.05, 0.25, h)); c = mix(c, top, smoothstep(0.25, 0.8, h)); gl_FragColor = vec4(c, 1.0); }",
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

const SUN_DIR = new THREE.Vector3(-14, 26, -22).normalize();

function Lights({ plan }: { plan: QualityPlan }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(0, 0, -2);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -26;
    c.right = 26;
    c.top = 26;
    c.bottom = -26;
    c.near = 1;
    c.far = 90;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.04;
  }, []);
  return (
    <>
      <hemisphereLight args={["#fff0cf", "#4d6b2e", 1.15]} />
      <directionalLight
        ref={sun}
        position={[SUN_DIR.x * 50, SUN_DIR.y * 50, SUN_DIR.z * 50 - 2]}
        intensity={2.6}
        color="#ffd89c"
        castShadow={plan.shadows}
        shadow-mapSize-width={plan.shadowSize}
        shadow-mapSize-height={plan.shadowSize}
        shadow-radius={4}
      />
      <directionalLight position={[12, 10, 24]} intensity={0.55} color="#d6e4ff" />
      <ambientLight intensity={0.12} />
    </>
  );
}

// ------------------------------------------------------------------ ground
function Ground({ props, game }: { props: BlockProps; game: Game }) {
  const [grass, dirt] = useTiles([props.textures.grass, props.textures.dirt]);
  const mask = useMemo(maskTexture, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: grass, roughness: 0.96, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.dirtMap = { value: dirt };
      sh.uniforms.maskMap = { value: mask };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vOwW;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOwW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vOwW;\nuniform sampler2D dirtMap;\nuniform sampler2D maskMap;")
        .replace(
          "#include <map_fragment>",
          `vec3 owG = texture2D(map, vOwW.xz / 5.5).rgb;
           vec3 owG2 = texture2D(map, vOwW.xz / 23.0 + vec2(0.37, 0.71)).rgb;
           owG = mix(owG, owG2 * vec3(1.06, 1.02, 0.86), 0.38);
           vec3 owD = texture2D(dirtMap, vOwW.xz / 4.0).rgb;
           float owM = texture2D(maskMap, vOwW.xz / 80.0 + 0.5).r;
           float owN = texture2D(dirtMap, vOwW.xz / 31.0).r;
           owM = smoothstep(0.32, 0.68, owM + (owN - 0.45) * 0.35);
           diffuseColor.rgb *= mix(owG, owD, owM);`,
        );
    };
    return m;
  }, [grass, dirt, mask]);
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      receiveShadow
      material={mat}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current;
        down.current = null;
        if (!d || game.mode !== "play" || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
        game.walkTo = { x: e.point.x, z: e.point.z };
      }}
    >
      <circleGeometry args={[90, 64]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ set pieces
function Plaza({ url }: { url: string }) {
  const gltf = useModel(url);
  const glyph = useMemo(() => {
    let m: THREE.MeshStandardMaterial | null = null;
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.Material).name === "plaza_top") m = mesh.material as THREE.MeshStandardMaterial;
    });
    return m as THREE.MeshStandardMaterial | null;
  }, [gltf]);
  useFrame(({ clock }) => {
    if (glyph) glyph.emissiveIntensity = 0.55 + 0.35 * Math.sin(clock.elapsedTime * 0.9);
  });
  return <primitive object={gltf.scene} />;
}

function Tree({ url }: { url: string }) {
  const gltf = useModel(url);
  useMemo(() => {
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /leaves/.test(m.name + (m.material as THREE.Material).name)) addWind(m.material as THREE.Material, 0.035);
    });
  }, [gltf]);
  return <primitive object={gltf.scene} position={[TREE.x, 0, TREE.z]} rotation-y={TREE.ry} scale={TREE.scale} />;
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

function Stall({ url, spot, onPick }: { url: string; spot: (typeof STALLS)[number]; onPick: () => void }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh && /vines|herb|bloom|plant/.test(m.name + (m.material as THREE.Material).name)) addWind(m.material as THREE.Material, 0.25);
    });
    return o;
  }, [gltf]);
  return (
    <Clickable onPick={onPick}>
      <primitive object={obj} position={[spot.x, 0, spot.z]} rotation-y={spot.ry} />
    </Clickable>
  );
}

function Telescope({ url, onPick }: { url: string; onPick: () => void }) {
  const gltf = useModel(url);
  return (
    <Clickable onPick={onPick}>
      <primitive object={gltf.scene} position={[TELESCOPE.x, 0.2, TELESCOPE.z]} rotation-y={TELESCOPE.ry} />
    </Clickable>
  );
}

function Boulders({ url }: { url: string }) {
  const gltf = useModel(url);
  const variants = useMemo(() => ["boulder_a", "boulder_b", "boulder_c"].map((n) => meshesOf(gltf.scene, (x) => x === n)), [gltf]);
  return (
    <>
      {variants.map((parts, v) => (
        <Instanced key={v} parts={parts} shadows matrices={BOULDERS.filter((b) => b.variant === v).map((b) => mat4(b.x, -0.05, b.z, b.ry, b.s))} />
      ))}
    </>
  );
}

function Forest({ url, plan }: { url: string; plan: QualityPlan }) {
  const gltf = useModel(url);
  const parts = useMemo(() => {
    const p = meshesOf(gltf.scene);
    p.forEach((x) => /leaves/.test(x.name + x.mat.name) && addWind(x.mat, 0.03));
    return p;
  }, [gltf]);
  const list = plan.grass < 400 ? FOREST.filter((_, i) => i % 2 === 0) : FOREST;
  const matrices = useMemo(() => list.map((t) => mat4(t.x, -0.1, t.z, t.ry, t.s * 1.5)), [list]);
  return <Instanced parts={parts} matrices={matrices} shadows={plan.shadows && plan.shadowSize > 1024} />;
}

// ------------------------------------------------------------------ ground cover
function Foliage({ props, plan }: { props: BlockProps; plan: QualityPlan }) {
  const fern = useModel(props.models.fern);
  const flowers = useModel(props.models.flowers);
  const grass = useModel(props.models.grassTuft);
  const solid = useMemo(colliders, []);
  const free = (x: number, z: number, pad: number) => {
    const r = Math.hypot(x, z);
    if (r < PLAZA_R + 0.9 || r > 34) return false;
    if (pathMask(x, z) > 0.3) return false;
    if (keepClear(x, z, pad)) return false;
    for (const c of solid) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
    return true;
  };
  const layout = useMemo(() => {
    const R = rng(42);
    const g: THREE.Matrix4[] = [];
    const f: THREE.Matrix4[] = [];
    const fl: THREE.Matrix4[][] = [[], [], [], []];
    let guard = 0;
    while (g.length < plan.grass && guard++ < plan.grass * 6) {
      const a = R() * Math.PI * 2;
      const r = 8 + Math.sqrt(R()) * 24;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (!free(x, z, 0.1)) continue;
      const s = 0.7 + R() * 0.8;
      g.push(mat4(x, 0, z, R() * 6.28, s * 1.2, s));
    }
    // ferns: clustered at boulders, stalls, tree roots and the clearing's edge
    const anchors: { x: number; z: number; r: number }[] = [
      ...BOULDERS.map((b) => ({ x: b.x, z: b.z, r: 1.6 * b.s + 0.8 })),
      ...STALLS.map((s) => ({ ...stallPoint(s, 0, -1.6), r: 2.4 })),
      { x: TREE.x, z: TREE.z, r: 5.5 },
      ...Array.from({ length: 10 }, (_, i) => ({ x: Math.sin(i * 0.63 + 0.3) * 9.6, z: Math.cos(i * 0.63 + 0.3) * 9.6, r: 1.2 })),
    ];
    guard = 0;
    while (f.length < plan.ferns && guard++ < plan.ferns * 10) {
      let x: number;
      let z: number;
      if (R() < 0.6) {
        const an = anchors[Math.floor(R() * anchors.length)];
        const a = R() * Math.PI * 2;
        x = an.x + Math.sin(a) * an.r * (0.8 + R() * 0.6);
        z = an.z + Math.cos(a) * an.r * (0.8 + R() * 0.6);
      } else {
        const a = R() * Math.PI * 2;
        const r = 15 + R() * 15;
        x = Math.sin(a) * r;
        z = Math.cos(a) * r;
      }
      if (!free(x, z, 0.3)) continue;
      f.push(mat4(x, 0, z, R() * 6.28, 0.9 + R() * 0.9));
    }
    // flowers in patches of one colour
    guard = 0;
    let n = 0;
    while (n < plan.flowers && guard++ < plan.flowers * 8) {
      const a = R() * Math.PI * 2;
      const r = 8.2 + R() * 20;
      const cx = Math.sin(a) * r;
      const cz = Math.cos(a) * r;
      const kind = Math.floor(R() * 4);
      const k = 3 + Math.floor(R() * 5);
      for (let i = 0; i < k && n < plan.flowers; i++) {
        const x = cx + (R() - 0.5) * 2.2;
        const z = cz + (R() - 0.5) * 2.2;
        if (!free(x, z, 0.15)) continue;
        fl[kind].push(mat4(x, 0, z, R() * 6.28, 0.7 + R() * 0.5));
        n++;
      }
    }
    return { g, f, fl };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.grass, plan.ferns, plan.flowers]);
  const parts = useMemo(() => {
    const fp = meshesOf(fern.scene);
    const gp = meshesOf(grass.scene);
    const flp = ["flowers_blue", "flowers_yellow", "flowers_pink", "flowers_white"].map((nm) => meshesOf(flowers.scene, (x) => x === nm));
    [...fp, ...gp, ...flp.flat()].forEach((p) => addWind(p.mat, 1));
    // painted cards are lit from one side only: lift them so the ground cover reads bright and lush
    fp.forEach((p) => (p.mat as THREE.MeshStandardMaterial).color.setRGB(1.45, 1.5, 1.3));
    gp.forEach((p) => (p.mat as THREE.MeshStandardMaterial).color.setRGB(1.3, 1.35, 1.15));
    flp.flat().forEach((p) => (p.mat as THREE.MeshStandardMaterial).color.setRGB(1.2, 1.2, 1.2));
    return { fp, gp, flp };
  }, [fern, grass, flowers]);
  return (
    <>
      <Instanced parts={parts.gp} matrices={layout.g} />
      <Instanced parts={parts.fp} matrices={layout.f} shadows={plan.shadowSize > 1024} />
      {parts.flp.map((p, i) => (
        <Instanced key={i} parts={p} matrices={layout.fl[i]} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ atmosphere
function LightShafts() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "rgba(255,226,160,0)");
    v.addColorStop(0.35, "rgba(255,226,160,0.9)");
    v.addColorStop(1, "rgba(255,226,160,0)");
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
  const shafts = useMemo(() => [-6.5, -2.5, 2.2, 6.0].map((x, i) => ({ x, w: 1.6 + (i % 2) * 1.4, o: 0.06 + (i % 3) * 0.025 })), []);
  const tilt = Math.atan2(Math.hypot(SUN_DIR.x, SUN_DIR.z), SUN_DIR.y);
  const yaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (m) (m.material as THREE.MeshBasicMaterial).opacity = shafts[i].o * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 0.4 + i * 1.7));
    });
  });
  return (
    <group position={[0, 0, -5]}>
      {shafts.map((s, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[s.x, 7, -1 + i * 0.6]} rotation={new THREE.Euler(tilt, yaw, 0, "YXZ")} renderOrder={5}>
          <planeGeometry args={[s.w, 20]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={s.o} fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Fireflies({ count = 70 }: { count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  const seeds = useMemo(() => {
    const R = rng(7);
    return Array.from({ length: count }, () => ({ x: (R() - 0.5) * 30, z: -14 + R() * 26, y: 0.6 + R() * 5, s: 0.2 + R() * 0.5, p: R() * 6.28 }));
  }, [count]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    seeds.forEach((s, i) => {
      a.setXYZ(i, s.x + Math.sin(t * s.s + s.p) * 1.4, s.y + Math.sin(t * s.s * 1.7 + s.p) * 0.5, s.z + Math.cos(t * s.s * 0.8 + s.p) * 1.4);
    });
    a.needsUpdate = true;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={glowTexture()} size={0.32} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffd98a" />
    </points>
  );
}

// ------------------------------------------------------------------ world
export function World({ props, game, plan, onOpen }: { props: BlockProps; game: Game; plan: QualityPlan; onOpen: (c: CardState) => void }) {
  const m = props.models;
  const stallUrl: Record<string, string> = { biome: m.stallBiome, chrono: m.stallChrono, sky: m.stallSky };
  useEffect(() => {
    const keep = game.targets.filter((t) => t.kind === "lantern");
    const own = STALLS.map((st) => {
      const p = stallPoint(st, 0, 2.3);
      return { key: "stall-" + st.key, kind: "stall" as const, ref: st.district, x: p.x, z: p.z, reach: 2.4 };
    });
    game.targets = keep.concat(own, [{ key: "telescope", kind: "telescope", ref: "telescope", x: TELESCOPE.x + 0.9, z: TELESCOPE.z + 0.6, reach: 2.2 }]);
  }, [game]);
  return (
    <>
      <SkyDome />
      <Lights plan={plan} />
      <Ground props={props} game={game} />
      <Plaza url={m.plaza} />
      <Tree url={m.tree} />
      {STALLS.map((st) => (
        <Stall key={st.key} url={stallUrl[st.key]} spot={st} onPick={() => onOpen({ kind: "stall", district: st.district })} />
      ))}
      <Telescope url={m.telescope} onPick={() => onOpen({ kind: "telescope" })} />
      <Boulders url={m.boulders} />
      <Forest url={m.forestTree} plan={plan} />
      <Foliage props={props} plan={plan} />
      {plan.extras && <LightShafts />}
      {plan.extras && <Fireflies />}
    </>
  );
}

export { wind };
