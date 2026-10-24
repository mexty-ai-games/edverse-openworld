// The Chrono Quarter: a Roman forum (~100 CE), a Classic Maya pyramid plaza (250-900 CE) and an Edo
// garden with a koi pond (1603-1868), joined by cobbled streets with lamps, under a warm dusk haze.
// Renders inside the hub's <Canvas> (same `game` and quality `plan` as the hub World).
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { pickLanguage, useLanguage } from "@mexty/sdk";
import type { Game, Target } from "../../game/state";
import type { QualityPlan } from "../../settings";
import type { CardState } from "../../ui/Cards";
import { addWind, glowTexture, useModel, useTiles } from "../../scene/assets";
import type { ChronoQuarterProps } from "./types";
import {
  ARTIFACT_SPOTS, BRIDGE, CHERRIES, COLUMNS, DIAL, EXIT, FOREST, FOUNTAIN, GATE, JUNGLE, LAMPS, PAVILION, POND, PYRAMID, ROCKS, STANDS,
  STELAE, STONE_LANTERNS, TEMPLE, colliders, pavingMask, pondR, streetMask, terrainY,
} from "./layout";
import { useCase } from "./store";
import { SUN_DIR, beamTexture, fallMaterial, makeInstanced, mat4, meshesOf, petalTexture, rng, waterMaterial, type Part } from "./three-utils";

export const KIND_ARTIFACT = "chrono-quarter:artifact";
export const KIND_STAND = "chrono-quarter:stand";
export const KIND_DIAL = "chrono-quarter:dial";

/** Opens a district target the same way the HUD's action button does (the Activity listens). */
export function openTarget(t: Target) {
  window.dispatchEvent(new CustomEvent("ow-open", { detail: t }));
}

function target(key: string, kind: string, ref: string, x: number, z: number, reach: number): Target {
  return { key, kind: kind as unknown as Target["kind"], ref, x, z, reach };
}

// ------------------------------------------------------------------ mood: sky, haze, light
function Dusk() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const prevFog = scene.fog;
    const prevExp = gl.toneMappingExposure;
    scene.fog = new THREE.Fog("#e2a77f", 24, 78);
    gl.toneMappingExposure = 1.08;
    return () => {
      scene.fog = prevFog;
      gl.toneMappingExposure = prevExp;
    };
  }, [scene, gl]);
  return null;
}

function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#55669e") },
          mid: { value: new THREE.Color("#e6987a") },
          low: { value: new THREE.Color("#ffd29c") },
          sun: { value: SUN_DIR.clone() },
        },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sun; varying vec3 vP;
          void main(){
            float h = vP.y;
            vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, h));
            c = mix(c, top, smoothstep(0.22, 0.85, h));
            float s = max(dot(normalize(vP), sun), 0.0);
            c += vec3(1.0, 0.72, 0.42) * (pow(s, 6.0) * 0.55 + pow(s, 120.0) * 1.6);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

/** The hazy far-off city of the three eras, wrapped around the horizon. */
function Skyline({ url }: { url: string }) {
  const [tex] = useTiles([url]);
  const mat = useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(3, 1);
    t.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide, color: new THREE.Color(1.0, 0.86, 0.78), opacity: 0.92 });
  }, [tex]);
  return (
    <mesh material={mat} position={[0, 7, 0]} renderOrder={-9}>
      <cylinderGeometry args={[70, 70, 22, 64, 1, true]} />
    </mesh>
  );
}

function Lights({ plan }: { plan: QualityPlan }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(0, 0, -1);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -30;
    c.right = 30;
    c.top = 30;
    c.bottom = -30;
    c.near = 1;
    c.far = 120;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.05;
  }, []);
  return (
    <>
      <hemisphereLight args={["#ffd2b0", "#5b4a3c", 1.05]} />
      <directionalLight
        ref={sun}
        position={[SUN_DIR.x * 60, SUN_DIR.y * 60, SUN_DIR.z * 60 - 1]}
        intensity={2.7}
        color="#ffbf80"
        castShadow={plan.shadows}
        shadow-mapSize-width={plan.shadowSize}
        shadow-mapSize-height={plan.shadowSize}
        shadow-radius={4}
      />
      <directionalLight position={[20, 10, 18]} intensity={0.45} color="#b9c2ff" />
      <ambientLight intensity={0.14} color="#ffe2c8" />
    </>
  );
}

// ------------------------------------------------------------------ ground
const MASK_N = 512;
const MASK_SPAN = 64;

function maskTexture(): THREE.DataTexture {
  const data = new Uint8Array(MASK_N * MASK_N * 4);
  for (let j = 0; j < MASK_N; j++)
    for (let i = 0; i < MASK_N; i++) {
      const x = (i / MASK_N - 0.5) * MASK_SPAN;
      const z = (j / MASK_N - 0.5) * MASK_SPAN;
      const o = (j * MASK_N + i) * 4;
      const pv = pavingMask(x, z);
      data[o] = Math.round(streetMask(x, z) * (1 - pv * 0.85) * 255);
      data[o + 1] = Math.round(pv * 255);
      const r = pondR(x, z);
      data[o + 2] = Math.round(Math.max(0, Math.min(1, (1.25 - r) / 0.3)) * 255);
      data[o + 3] = 255;
    }
  const t = new THREE.DataTexture(data, MASK_N, MASK_N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function Ground({ props, game }: { props: ChronoQuarterProps; game: Game }) {
  const tx = props.textures;
  const [grass, dirt, cobbles, paving] = useTiles([tx.grass, tx.dirt, tx.cobbles, tx.paving]);
  const mask = useMemo(maskTexture, []);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(110, 110, 220, 220);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, terrainY(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.dirtMap = { value: dirt };
      sh.uniforms.cobMap = { value: cobbles };
      sh.uniforms.pavMap = { value: paving };
      sh.uniforms.maskMap = { value: mask };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vCqW;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCqW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vCqW;\nuniform sampler2D dirtMap;\nuniform sampler2D cobMap;\nuniform sampler2D pavMap;\nuniform sampler2D maskMap;")
        .replace(
          "#include <map_fragment>",
          `vec3 cqG = texture2D(map, vCqW.xz / 5.5).rgb;
           vec3 cqG2 = texture2D(map, vCqW.xz / 23.0 + vec2(0.37, 0.71)).rgb;
           cqG = mix(cqG, cqG2 * vec3(1.08, 1.0, 0.8), 0.4);
           vec3 cqC = texture2D(cobMap, vCqW.xz / 2.3).rgb;
           vec3 cqP = texture2D(pavMap, vCqW.xz / 4.6).rgb;
           vec3 cqD = texture2D(dirtMap, vCqW.xz / 3.0).rgb * vec3(0.55, 0.6, 0.55);
           vec4 cqM = texture2D(maskMap, vCqW.xz / ${MASK_SPAN.toFixed(1)} + 0.5);
           float cqN = texture2D(dirtMap, vCqW.xz / 29.0).r;
           float ms = smoothstep(0.3, 0.7, cqM.r + (cqN - 0.45) * 0.25);
           float mp = smoothstep(0.3, 0.7, cqM.g + (cqN - 0.45) * 0.3);
           float md = smoothstep(0.15, 0.6, cqM.b);
           vec3 cqCol = mix(cqG, cqC, ms);
           cqCol = mix(cqCol, cqP, mp);
           cqCol = mix(cqCol, cqD, md);
           diffuseColor.rgb *= cqCol;`,
        );
    };
    return m;
  }, [grass, dirt, cobbles, paving, mask]);
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      geometry={geo}
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
    />
  );
}

// ------------------------------------------------------------------ water and pond life
function Pond({ url }: { url: string }) {
  const gltf = useModel(url);
  const water = useMemo(() => waterMaterial({ deep: "#2b6773", shallow: "#4c9497", sky: "#f4bf98", opacity: 0.7, scale: 1.6 }), []);
  const parts = useMemo(() => {
    const koi = meshesOf(gltf.scene, (n) => n === "koi");
    const pad = meshesOf(gltf.scene, (n) => n === "lily_pad");
    const lotus = meshesOf(gltf.scene, (n) => n === "lotus");
    return { koi, pad, lotus };
  }, [gltf]);
  const pads = useMemo(() => {
    const R = rng(5);
    const out: THREE.Matrix4[] = [];
    const flowers: THREE.Matrix4[] = [];
    let guard = 0;
    while (out.length < 18 && guard++ < 400) {
      const a = R() * Math.PI * 2;
      const r = 0.35 + Math.sqrt(R()) * 0.55;
      const x = POND.cx + Math.sin(a) * POND.rx * r;
      const z = POND.cz + Math.cos(a) * POND.rz * r;
      if (Math.abs(z - POND.cz) < 1.2) continue;
      const s = 0.8 + R() * 0.7;
      out.push(mat4(x, POND.water + 0.012, z, R() * 6.28, s));
      if (R() < 0.35) flowers.push(mat4(x + 0.05, POND.water + 0.02, z, R() * 6.28, 1.2 + R() * 0.5));
    }
    return { out, flowers };
  }, []);
  const padMeshes = useMemo(() => [...makeInstanced(parts.pad, pads.out, false), ...makeInstanced(parts.lotus, pads.flowers, false)], [parts, pads]);
  // koi swim slow loops under the surface
  const fish = useMemo(() => {
    const R = rng(9);
    return Array.from({ length: 7 }, (_, i) => ({ r: 0.35 + R() * 0.45, sp: (0.18 + R() * 0.15) * (i % 2 ? 1 : -1), ph: R() * 6.28, s: 1.6 + R() * 1.1, y: POND.water - 0.16 - R() * 0.12 }));
  }, []);
  const koiMesh = useMemo(() => makeInstanced(parts.koi, fish.map(() => new THREE.Matrix4()), false), [parts, fish]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    water.uniforms.uTime.value = t;
    const m = new THREE.Matrix4();
    fish.forEach((f, i) => {
      const a = f.ph + t * f.sp;
      const wob = Math.sin(t * 0.7 + i) * 0.08;
      const x = POND.cx + Math.sin(a) * POND.rx * (f.r + wob);
      const z = POND.cz + Math.cos(a) * POND.rz * (f.r + wob);
      // heading along the loop (tangent), plus a little tail wiggle
      const ry = Math.atan2(Math.cos(a) * POND.rx * f.sp, -Math.sin(a) * POND.rz * f.sp) + Math.PI + Math.sin(t * 6 + i) * 0.12;
      m.compose(new THREE.Vector3(x, f.y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(f.s, f.s, f.s));
      koiMesh.forEach((k) => {
        k.setMatrixAt(i, m);
        k.instanceMatrix.needsUpdate = true;
      });
    });
  });
  return (
    <>
      <mesh material={water} position={[POND.cx, POND.water, POND.cz]} rotation-x={-Math.PI / 2} scale={[POND.rx * 1.06, POND.rz * 1.06, 1]} renderOrder={2}>
        <circleGeometry args={[1, 48]} />
      </mesh>
      {koiMesh.map((m, i) => (
        <primitive key={"k" + i} object={m} />
      ))}
      {padMeshes.map((m, i) => (
        <primitive key={"p" + i} object={m} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ set pieces
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

function windOn(obj: THREE.Object3D, re: RegExp, strength: number) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && re.test(m.name + " " + (m.material as THREE.Material).name)) addWind(m.material as THREE.Material, strength);
  });
}

function Temple({ url }: { url: string }) {
  const gltf = useModel(url);
  return <primitive object={gltf.scene} position={[TEMPLE.x, 0, TEMPLE.z]} rotation-y={TEMPLE.ry} scale={TEMPLE.s} />;
}

function Fountain({ url, plan }: { url: string; plan: QualityPlan }) {
  const gltf = useModel(url);
  const water = useMemo(() => waterMaterial({ deep: "#2b6670", shallow: "#58a3a6", sky: "#f6c9a2", opacity: 0.82, scale: 3.2 }), []);
  const fall = useMemo(fallMaterial, []);
  const obj = useMemo(() => {
    const o = gltf.scene;
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      const n = (m.material as THREE.Material).name;
      if (n === "fountain_water") {
        m.material = water;
        m.castShadow = false;
        m.renderOrder = 2;
      } else if (n === "fountain_fall") {
        m.material = fall;
        m.castShadow = false;
        m.renderOrder = 3;
      }
    });
    return o;
  }, [gltf, water, fall]);
  // splash droplets around the falling curtains
  const N = plan.extras ? 90 : 0;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, N) * 3), 3));
    return g;
  }, [N]);
  const seeds = useMemo(() => {
    const R = rng(3);
    return Array.from({ length: N }, () => ({ a: R() * 6.28, r: R() < 0.6 ? 1.3 : 0.76, top: R() < 0.6 ? 0.55 : 1.8, p: R(), s: 0.6 + R() * 0.6 }));
  }, [N]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    water.uniforms.uTime.value = t;
    fall.uniforms.uTime.value = t;
    if (!N) return;
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    seeds.forEach((s, i) => {
      const k = (t * s.s + s.p) % 1;
      a.setXYZ(i, FOUNTAIN.x + Math.cos(s.a + k) * (s.r + k * 0.25), s.top + Math.sin(k * Math.PI) * 0.22, FOUNTAIN.z + Math.sin(s.a + k) * (s.r + k * 0.25));
    });
    a.needsUpdate = true;
  });
  return (
    <>
      <primitive object={obj} position={[FOUNTAIN.x, 0, FOUNTAIN.z]} />
      {N > 0 && (
        <points geometry={geo} frustumCulled={false}>
          <pointsMaterial map={glowTexture()} size={0.14} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#dff4ff" />
        </points>
      )}
    </>
  );
}

function Placed({ url, x, z, ry, s = 1, wind }: { url: string; x: number; z: number; ry: number; s?: number; wind?: RegExp }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    if (wind) windOn(o, wind, 0.2);
    return o;
  }, [gltf, wind]);
  return <primitive object={obj} position={[x, 0, z]} rotation-y={ry} scale={s} />;
}

function Instances({ url, list, names, shadows, wind, tint }: {
  url: string;
  list: { variant: number; x: number; z: number; s: number; ry: number; y?: number }[];
  names: string[];
  shadows: boolean;
  wind?: [RegExp, number];
  tint?: [RegExp, THREE.Color];
}) {
  const gltf = useModel(url);
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    names.forEach((nm, v) => {
      const parts: Part[] = meshesOf(gltf.scene, (n) => n === nm);
      parts.forEach((p) => {
        if (wind && wind[0].test(p.name + " " + p.mat.name)) addWind(p.mat, wind[1]);
        if (tint && tint[0].test(p.mat.name)) {
          // a clone: the Idea Grove shares this cached material and keeps its own colour
          const c = (p.mat as THREE.MeshStandardMaterial).clone();
          c.color.copy(tint[1]);
          c.userData = {};
          addWind(c, wind ? wind[1] : 0.03);
          p.mat = c;
        }
      });
      const ms = list.filter((p) => p.variant === v).map((p) => mat4(p.x, p.y ?? 0, p.z, p.ry, p.s));
      if (ms.length) out.push(...makeInstanced(parts, ms, shadows));
    });
    return out;
  }, [gltf, list, names, shadows, wind, tint]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

function Gate({ url }: { url: string }) {
  const gltf = useModel(url);
  const portal = useMemo(() => {
    let mat: THREE.MeshStandardMaterial | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === "gate_portal") {
        const pm = (m.material as THREE.MeshStandardMaterial).clone();
        pm.transparent = true;
        pm.opacity = 0.85;
        pm.depthWrite = false;
        if (pm.map) {
          pm.map = pm.map.clone();
          pm.map.center.set(0.5, 0.45);
          pm.emissiveMap = pm.map;
        }
        m.material = pm;
        m.castShadow = false;
        mat = pm;
      }
    });
    windOn(gltf.scene, /vines/, 0.25);
    return mat as THREE.MeshStandardMaterial | null;
  }, [gltf]);
  useFrame(({ clock }, dt) => {
    if (!portal) return;
    if (portal.map) portal.map.rotation += Math.min(dt, 0.1) * 0.35;
    portal.emissiveIntensity = 1.3 + 0.4 * Math.sin(clock.elapsedTime * 1.6);
  });
  return <primitive object={gltf.scene} position={[GATE.x, 0, GATE.z]} rotation-y={GATE.ry} />;
}

function Lamps({ url, plan }: { url: string; plan: QualityPlan }) {
  const list = useMemo(() => LAMPS.map((l, i) => ({ variant: 0, x: l.x, z: l.z, s: 1, ry: i * 0.7 })), []);
  const glows = useMemo(() => LAMPS.map((l) => new THREE.Vector3(l.x, 3.05, l.z)), []);
  // a few warm point lights on the square (the nearest lamps); the rest glow with bloom only
  const lit = plan.extras ? [0, 2, 3, 4, 8, 1] : [];
  return (
    <>
      <Instances url={url} list={list} names={["street_lamp"]} shadows={plan.shadows && plan.shadowSize > 1024} />
      {glows.map((p, i) => (
        <sprite key={i} position={p} scale={[1.3, 1.3, 1.3]}>
          <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffc070" opacity={0.85} />
        </sprite>
      ))}
      {lit.map((i) => (
        <pointLight key={"l" + i} position={[LAMPS[i].x, 2.9, LAMPS[i].z]} color="#ffab55" intensity={6} distance={9} decay={1.6} />
      ))}
    </>
  );
}

/** Ground cover (Idea Grove fern, wildflowers, grass tufts) on the grass, away from streets and water. */
function Foliage({ props, plan }: { props: ChronoQuarterProps; plan: QualityPlan }) {
  const fern = useModel(props.models.fern);
  const flowers = useModel(props.models.flowers);
  const grass = useModel(props.models.grassTuft);
  const solid = useMemo(colliders, []);
  const layout = useMemo(() => {
    const free = (x: number, z: number, pad: number) => {
      const r = Math.hypot(x, z);
      if (r > 33) return false;
      if (streetMask(x, z) > 0.05 || pavingMask(x, z) > 0.05) return false;
      if (pondR(x, z) < 1.18) return false;
      if (Math.hypot(x - PYRAMID.x, z - PYRAMID.z) < 7.2) return false;
      for (const c of solid) if (c.r > 1.2 ? false : Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
      if (Math.abs(x - PAVILION.x) < 3.6 && Math.abs(z - PAVILION.z) < 3.4) return false;
      if (Math.abs(x - TEMPLE.x) < 6.2 && Math.abs(z - TEMPLE.z) < 4.6) return false;
      return true;
    };
    const R = rng(77);
    const g: THREE.Matrix4[] = [];
    const f: THREE.Matrix4[] = [];
    const fl: THREE.Matrix4[][] = [[], [], [], []];
    let guard = 0;
    const nG = Math.round(plan.grass * 0.45);
    while (g.length < nG && guard++ < nG * 8) {
      const x = (R() - 0.5) * 62;
      const z = (R() - 0.5) * 62;
      if (!free(x, z, 0.1)) continue;
      const s = 0.7 + R() * 0.8;
      g.push(mat4(x, 0, z, R() * 6.28, s * 1.2, s));
    }
    const anchors = [
      ...CHERRIES.map((c) => ({ x: c.x, z: c.z, r: 1.4 })),
      ...STONE_LANTERNS.map((c) => ({ x: c.x, z: c.z, r: 0.9 })),
      ...COLUMNS.map((c) => ({ x: c.x, z: c.z, r: 1.0 })),
      { x: POND.cx, z: POND.cz, r: 5.4 },
      ...JUNGLE.map((c) => ({ x: c.x, z: c.z, r: 1.2 })),
    ];
    guard = 0;
    const nF = Math.round(plan.ferns * 1.3);
    while (f.length < nF && guard++ < nF * 12) {
      let x: number;
      let z: number;
      if (R() < 0.7) {
        const an = anchors[Math.floor(R() * anchors.length)];
        const a = R() * Math.PI * 2;
        x = an.x + Math.sin(a) * an.r * (0.8 + R() * 0.6);
        z = an.z + Math.cos(a) * an.r * (0.8 + R() * 0.6);
      } else {
        x = (R() - 0.5) * 60;
        z = (R() - 0.5) * 60;
      }
      if (!free(x, z, 0.25)) continue;
      f.push(mat4(x, 0, z, R() * 6.28, 0.8 + R() * 0.8));
    }
    guard = 0;
    let n = 0;
    const nFl = Math.round(plan.flowers * 1.4);
    while (n < nFl && guard++ < nFl * 10) {
      const cx = (R() - 0.5) * 50;
      const cz = (R() - 0.5) * 50;
      const kind = R() < 0.45 ? 2 : Math.floor(R() * 4);
      const k = 3 + Math.floor(R() * 5);
      for (let i = 0; i < k && n < nFl; i++) {
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
  const meshes = useMemo(() => {
    const fp = meshesOf(fern.scene);
    const gp = meshesOf(grass.scene);
    const flp = ["flowers_blue", "flowers_yellow", "flowers_pink", "flowers_white"].map((nm) => meshesOf(flowers.scene, (x) => x === nm));
    // clones so the Idea Grove's own (shared, cached) materials keep their tint
    const tinted = (ps: Part[], c: [number, number, number]) =>
      ps.map((p) => {
        const m = (p.mat as THREE.MeshStandardMaterial).clone();
        m.color.setRGB(c[0], c[1], c[2]);
        m.userData = {};
        addWind(m, 1);
        return { ...p, mat: m };
      });
    const out: THREE.InstancedMesh[] = [];
    out.push(...makeInstanced(tinted(gp, [1.35, 1.22, 0.95]), layout.g, false));
    out.push(...makeInstanced(tinted(fp, [1.4, 1.35, 1.05]), layout.f, plan.shadowSize > 1024));
    flp.forEach((p, i) => out.push(...makeInstanced(tinted(p, [1.2, 1.15, 1.1]), layout.fl[i], false)));
    return out;
  }, [fern, grass, flowers, layout, plan.shadowSize]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ atmosphere
function Petals({ count = 120 }: { count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const seeds = useMemo(() => {
    const R = rng(11);
    return Array.from({ length: count }, (_, i) => {
      const c = CHERRIES[i % CHERRIES.length];
      return { x: c.x + (R() - 0.5) * 4, z: c.z + (R() - 0.5) * 4, h: 3.2 + R() * 1.5, sp: 0.18 + R() * 0.2, p: R(), d: R() * 6.28 };
    });
  }, [count]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    seeds.forEach((s, i) => {
      const k = (t * s.sp * 0.25 + s.p) % 1;
      const drift = k * 3.5;
      a.setXYZ(i, s.x + Math.cos(s.d) * drift + Math.sin(t * 1.3 + i) * 0.3, s.h * (1 - k) + 0.05, s.z + Math.sin(s.d) * drift + Math.cos(t * 1.1 + i) * 0.3);
    });
    a.needsUpdate = true;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={petalTexture()} size={0.16} sizeAttenuation transparent alphaTest={0.3} depthWrite={false} color="#ffd6e4" />
    </points>
  );
}

function Fireflies({ count = 50 }: { count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const seeds = useMemo(() => {
    const R = rng(23);
    return Array.from({ length: count }, (_, i) => {
      const zone = i % 3;
      const c = zone === 0 ? { x: POND.cx, z: POND.cz } : zone === 1 ? { x: PYRAMID.x, z: PYRAMID.z + 8 } : { x: -8, z: 12 };
      return { x: c.x + (R() - 0.5) * 12, z: c.z + (R() - 0.5) * 10, y: 0.5 + R() * 2.5, s: 0.2 + R() * 0.5, p: R() * 6.28 };
    });
  }, [count]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    seeds.forEach((s, i) => a.setXYZ(i, s.x + Math.sin(t * s.s + s.p) * 1.2, s.y + Math.sin(t * s.s * 1.7 + s.p) * 0.4, s.z + Math.cos(t * s.s * 0.8 + s.p) * 1.2));
    a.needsUpdate = true;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={glowTexture()} size={0.3} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffd98a" />
    </points>
  );
}

/** A soft column of light (crossed planes) over a thing to find or a place to go. */
function Beam({ x, z, y = 0, h = 3.2, w = 0.9, color = "#ffd27a", pulse = 1 }: { x: number; z: number; y?: number; h?: number; w?: number; color?: string; pulse?: number }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    [color],
  );
  useFrame(({ clock }) => {
    mat.opacity = (0.55 + 0.3 * Math.sin(clock.elapsedTime * 2.2 + x)) * pulse;
  });
  return (
    <group position={[x, y + h / 2, z]}>
      <mesh material={mat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={mat} rotation-y={Math.PI / 2}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the case: artifacts, stands, dial
function useArtifactObjects(url: string, props: ChronoQuarterProps) {
  const gltf = useModel(url);
  return useMemo(() => {
    const m: Record<string, THREE.Object3D> = {};
    for (const a of props.artifacts) {
      const src = gltf.scene.getObjectByName(a.mesh);
      if (src) m[a.id] = src;
    }
    return m;
  }, [gltf, props.artifacts]);
}

function ArtifactModel({ src, scale }: { src: THREE.Object3D; scale: number }) {
  const obj = useMemo(() => {
    const o = src.clone(true);
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  }, [src]);
  return <primitive object={obj} scale={scale} />;
}

function LostArtifact({ id, src, scale, x, z }: { id: string; src: THREE.Object3D; scale: number; x: number; z: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + x;
    if (g.current) {
      g.current.position.y = 0.08 + Math.sin(t * 2) * 0.06;
      g.current.rotation.y = t * 0.6;
    }
  });
  return (
    <group position={[x, 0, z]}>
      <Clickable onPick={() => openTarget(target("cq-a-" + id, KIND_ARTIFACT, id, x, z, 1.8))}>
        <group ref={g}>
          <ArtifactModel src={src} scale={scale} />
        </group>
        <mesh position={[0, 0.6, 0]} visible={false}>
          <boxGeometry args={[1.2, 1.4, 1.2]} />
        </mesh>
      </Clickable>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Beam x={0} z={0} h={3.4} w={0.8} />
      <sprite position={[0, 1.0, 0]} scale={[1.2, 1.2, 1.2]}>
        <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffe2a0" opacity={0.7} />
      </sprite>
    </group>
  );
}

function Carried({ game, src, scale }: { game: Game; src: THREE.Object3D; scale: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const me = game.me;
    if (g.current) {
      g.current.position.set(me.x, me.y + 1.95 + Math.sin(clock.elapsedTime * 3) * 0.06, me.z);
      g.current.rotation.y = clock.elapsedTime * 1.2;
    }
  });
  return (
    <group ref={g}>
      <ArtifactModel src={src} scale={scale * 0.85} />
      <sprite position={[0, 0.15, 0]} scale={[0.9, 0.9, 0.9]}>
        <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffe2a0" opacity={0.6} />
      </sprite>
    </group>
  );
}

const STAND_MESH: Record<string, string> = { rome: "plinth_rome", edo: "plinth_edo", maya: "plinth_maya" };
const STAND_TOP: Record<string, number> = { rome: 1.02, edo: 1.0, maya: 1.0 };

function Stand({ url, era, label, icon, color, items, objs, scales, glow }: {
  url: string;
  era: string;
  label: string;
  icon: string;
  color: string;
  items: string[];
  objs: Record<string, THREE.Object3D>;
  scales: Record<string, number>;
  glow: boolean;
}) {
  const gltf = useModel(url);
  const s = STANDS[era];
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName(STAND_MESH[era]);
    const o = src ? src.clone(true) : new THREE.Group();
    o.position.set(0, 0, 0);
    return o;
  }, [gltf, era]);
  const slots = [
    [-0.28, -0.2],
    [0.28, -0.2],
    [-0.28, 0.24],
    [0.28, 0.24],
  ];
  return (
    <group position={[s.x, 0, s.z]} rotation-y={s.ry}>
      <Clickable onPick={() => openTarget(target("cq-s-" + era, KIND_STAND, era, s.x, s.z, 2.4))}>
        <primitive object={obj} />
        {items.slice(0, 4).map((id, i) =>
          objs[id] ? (
            <group key={id} position={[slots[i][0], STAND_TOP[era], slots[i][1]]} rotation-y={i * 0.6}>
              <ArtifactModel src={objs[id]} scale={(scales[id] || 2) * 0.42} />
            </group>
          ) : null,
        )}
      </Clickable>
      {glow && <Beam x={0} z={0} h={5} w={1.6} color="#ffe3a0" />}
      <Html position={[0, era === "edo" ? 3.2 : 2.3, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
        <div className="cq-sign" style={{ borderColor: color }}>
          <span className="cq-sign-icon">{icon}</span>
          {label}
        </div>
      </Html>
    </group>
  );
}

function Dial({ url, label, active }: { url: string; label: string; active: boolean }) {
  const gltf = useModel(url);
  const gem = useMemo(() => {
    let m: THREE.MeshStandardMaterial | null = null;
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.Material).name === "dial_glow") m = mesh.material as THREE.MeshStandardMaterial;
    });
    return m as THREE.MeshStandardMaterial | null;
  }, [gltf]);
  useFrame(({ clock }) => {
    if (gem) gem.emissiveIntensity = (active ? 3 : 1.2) + Math.sin(clock.elapsedTime * 2) * 0.6;
  });
  return (
    <group>
      <Clickable onPick={() => openTarget(target("cq-dial", KIND_DIAL, "dial", DIAL.x, DIAL.z, 2.9))}>
        <primitive object={gltf.scene} position={[DIAL.x, 0, DIAL.z]} rotation-y={DIAL.ry} />
      </Clickable>
      {active && <Beam x={DIAL.x} z={DIAL.z} h={6} w={2.2} color="#ffe3a0" />}
      <Html position={[DIAL.x, 2.3, DIAL.z]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
        <div className="cq-sign">
          <span className="cq-sign-icon">⏳</span>
          {label}
        </div>
      </Html>
    </group>
  );
}

function CaseObjects({ props, game }: { props: ChronoQuarterProps; game: Game }) {
  const c = useCase();
  const { language, defaultLanguage } = useLanguage();
  const tr = (x: { en?: string; fr?: string } | undefined) => pickLanguage(x || {}, language, defaultLanguage || "en");
  const objs = useArtifactObjects(props.models.artifacts, props);
  const scales = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of props.artifacts) m[a.id] = a.scale;
    return m;
  }, [props.artifacts]);
  const byId = useMemo(() => {
    const m: Record<string, (typeof props.artifacts)[number]> = {};
    for (const a of props.artifacts) m[a.id] = a;
    return m;
  }, [props.artifacts]);
  // the targets the explorer can use (action button) follow the case
  useEffect(() => {
    const out: Target[] = [];
    if (c.phase === "hunt") {
      for (const id of c.items) {
        if (c.delivered.indexOf(id) >= 0 || c.carrying === id) continue;
        const sp = ARTIFACT_SPOTS[c.spots[id]];
        if (sp) out.push(target("cq-a-" + id, KIND_ARTIFACT, id, sp.x, sp.z, 1.8));
      }
    }
    for (const k of Object.keys(STANDS)) out.push(target("cq-s-" + k, KIND_STAND, k, STANDS[k].x + Math.sin(STANDS[k].ry) * 1.1, STANDS[k].z + Math.cos(STANDS[k].ry) * 1.1, 2.3));
    out.push(target("cq-dial", KIND_DIAL, "dial", DIAL.x, DIAL.z + 1.7, 2.6));
    game.targets = out;
  }, [c, game]);
  useEffect(() => () => {
    game.targets = [];
  }, [game]);
  return (
    <>
      {c.phase === "hunt" &&
        c.items.map((id) => {
          if (c.delivered.indexOf(id) >= 0 || c.carrying === id || !objs[id]) return null;
          const sp = ARTIFACT_SPOTS[c.spots[id]];
          return sp ? <LostArtifact key={id} id={id} src={objs[id]} scale={scales[id]} x={sp.x} z={sp.z} /> : null;
        })}
      {c.carrying && objs[c.carrying] && <Carried game={game} src={objs[c.carrying]} scale={scales[c.carrying]} />}
      {props.eras.map((e) =>
        STANDS[e.id] ? (
          <Stand
            key={e.id}
            url={props.models.plinths}
            era={e.id}
            label={tr(e.name)}
            icon={e.icon}
            color={e.color}
            items={c.delivered.filter((id) => byId[id] && byId[id].era === e.id)}
            objs={objs}
            scales={scales}
            glow={c.hintEra === e.id && !!c.carrying}
          />
        ) : null,
      )}
      <Dial url={props.models.dial} label={tr(props.ui.dial)} active={c.phase === "timeline"} />
      <Html position={[GATE.x, 6.4, GATE.z]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
        <div className="cq-sign cq-sign-gate">🌳 {tr(props.ui.gate)}</div>
      </Html>
    </>
  );
}

/** Steps into the gate's arch -> back to the Idea Grove (once per visit to the arch). */
function ExitWatch({ game, onExit }: { game: Game; onExit: () => void }) {
  const armed = useRef(false);
  useFrame(() => {
    if (game.mode !== "play") return;
    const d = Math.hypot(game.me.x - EXIT.x, game.me.z - EXIT.z);
    if (d > EXIT.r + 1.2) armed.current = true;
    if (armed.current && d < EXIT.r) {
      armed.current = false;
      onExit();
    }
  });
  return null;
}

// ------------------------------------------------------------------ the district
export function Scene({ props, game, plan, onExit }: {
  props: ChronoQuarterProps;
  game: Game;
  plan: QualityPlan;
  onOpen?: (c: CardState) => void;
  onExit: () => void;
}) {
  const m = props.models;
  const forestTint = useMemo<[RegExp, THREE.Color]>(() => [/leaves/, new THREE.Color(1.0, 0.82, 0.66)], []);
  const blossomWind = useMemo<[RegExp, number]>(() => [/blossom/, 0.05], []);
  const jungleWind = useMemo<[RegExp, number]>(() => [/broadleaf|palm/, 0.25], []);
  const jungleTint = useMemo<[RegExp, THREE.Color]>(() => [/broadleaf|palm/, new THREE.Color(1.45, 1.4, 1.1)], []);
  const forestWind = useMemo<[RegExp, number]>(() => [/leaves/, 0.03], []);
  const lanterns = useMemo(() => STONE_LANTERNS.map((l) => ({ variant: 0, x: l.x, z: l.z, s: 1.15, ry: l.ry })), []);
  const columns = useMemo(() => COLUMNS.map((c) => ({ ...c })), []);
  const cherries = useMemo(() => (plan.grass < 400 ? CHERRIES.filter((_, i) => i % 3 !== 2) : CHERRIES).map((c) => ({ ...c, s: c.s * 0.88 })), [plan.grass]);
  const forest = useMemo(() => (plan.grass < 400 ? FOREST.filter((_, i) => i % 2 === 0) : FOREST).map((f) => ({ ...f, s: f.s * 0.95, y: -0.1 })), [plan.grass]);
  const bigShadows = plan.shadows && plan.shadowSize > 1024;
  return (
    <>
      <Dusk />
      <SkyDome />
      <Skyline url={props.textures.skyline} />
      <Lights plan={plan} />
      <Ground props={props} game={game} />
      <Pond url={m.pondLife} />
      <Temple url={m.temple} />
      <Fountain url={m.fountain} plan={plan} />
      <Instances url={m.columns} list={columns} names={["column_whole", "column_broken"]} shadows={plan.shadows} />
      <Placed url={m.pyramid} x={PYRAMID.x} z={PYRAMID.z} ry={PYRAMID.ry} s={PYRAMID.s} wind={/vines|leaves|fern/} />
      {STELAE.map((s, i) => (
        <Placed key={i} url={m.stela} x={s.x} z={s.z} ry={s.ry} />
      ))}
      <Placed url={m.pavilion} x={PAVILION.x} z={PAVILION.z} ry={PAVILION.ry} />
      <Placed url={m.bridge} x={BRIDGE.x} z={BRIDGE.z} ry={0} />
      <Instances url={m.stoneLantern} list={lanterns} names={["stone_lantern"]} shadows={plan.shadows} />
      <Instances url={m.cherry} list={cherries} names={["cherry_a", "cherry_b"]} shadows={plan.shadows} wind={blossomWind} />
      <Instances url={m.jungle} list={JUNGLE} names={["jungle_broadleaf", "jungle_palm"]} shadows={bigShadows} wind={jungleWind} tint={jungleTint} />
      <Instances url={m.boulders} list={ROCKS} names={["boulder_a", "boulder_b", "boulder_c"]} shadows={plan.shadows} />
      <Instances url={m.forestTree} list={forest} names={["forest_tree"]} shadows={false} wind={forestWind} tint={forestTint} />
      <Lamps url={m.streetLamp} plan={plan} />
      <Gate url={m.gate} />
      <Foliage props={props} plan={plan} />
      <CaseObjects props={props} game={game} />
      <ExitWatch game={game} onExit={onExit} />
      {plan.extras && <Petals />}
      {plan.extras && <Fireflies />}
    </>
  );
}
