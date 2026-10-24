// Skyharbor: a cliff-top science town at night. Observatory, airship dock, glowing geodesic greenhouses,
// the robot workshop (Robot Courier), railed cliffs over a sea of clouds, stars and fireflies.
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useMexty } from "@mexty/sdk";
import * as THREE from "three";
import type { Game, TargetKind } from "../../game/state";
import type { QualityPlan } from "../../settings";
import { useSettings } from "../../settings";
import { addWind, useModel, useTiles } from "../../scene/assets";
import { sound as hubSound } from "../../audio";
import { skySound } from "./audio";
import type { SkyharborOpen, SkyharborProps } from "./types";
import { KIND_INFO, KIND_PLANETS, KIND_ROBOT } from "./types";
import {
  AIRSHIP, BENCHES, CRATES, DOCK, EXIT, GATE, GREENHOUSES, LAMPS, OBSERVATORY, PLATEAU_R, RAIL_R, ROBOT, ROCKS, TARGETS, TREES,
  WORKSHOP, colliders, local, paveMask, railOpen,
} from "./layout";
import { Part, mat4, materialsNamed, meshesOf, rng, tintedGlow } from "./util";

const MOON_DIR = new THREE.Vector3(-16, 30, -20).normalize();

// ------------------------------------------------------------------ instancing
function Instanced({ parts, matrices, shadows, receive = true }: { parts: Part[]; matrices: THREE.Matrix4[]; shadows?: boolean; receive?: boolean }) {
  const meshes = useMemo(
    () =>
      parts.map((p) => {
        const im = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, matrices.length));
        matrices.forEach((m, i) => im.setMatrixAt(i, m));
        im.count = matrices.length;
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = !!shadows;
        im.receiveShadow = receive;
        im.frustumCulled = false;
        return im;
      }),
    [parts, matrices, shadows, receive],
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

/** A model prop placed once (its own copy, so several districts / instances never share a node). */
function useClone(url: string) {
  const gltf = useModel(url);
  return useMemo(() => gltf.scene.clone(true), [gltf]);
}

// ------------------------------------------------------------------ sky, moon, mood
function NightSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `
          varying vec3 vP; uniform float uTime;
          float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                       mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
          float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
          float stars(vec3 d, float scale, float th){ vec3 g = d * scale; vec3 id = floor(g); float r = h3(id);
            vec3 c = vec3(h3(id + 1.3), h3(id + 2.7), h3(id + 4.1)) * 0.6 + 0.2; float dist = length(fract(g) - c);
            float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
            return step(th, r) * smoothstep(0.16, 0.0, dist) * tw * (0.6 + 2.4 * (r - th) / (1.0 - th)); }
          void main(){
            vec3 d = normalize(vP); float h = d.y;
            vec3 low = vec3(0.09, 0.22, 0.30); vec3 mid = vec3(0.045, 0.085, 0.19); vec3 top = vec3(0.016, 0.025, 0.075);
            vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, h)); c = mix(c, top, smoothstep(0.22, 0.85, h));
            c = mix(vec3(0.05, 0.11, 0.16), c, smoothstep(-0.3, 0.0, h));
            vec3 axis = normalize(vec3(0.55, 0.35, 0.75));
            float band = 1.0 - abs(dot(d, axis));
            float n = fbm(d * 3.5 + vec3(1.7, 0.0, 3.1));
            float mw = pow(smoothstep(0.72, 1.0, band), 1.6) * (0.35 + 0.9 * n);
            c += vec3(0.10, 0.16, 0.28) * mw + vec3(0.12, 0.05, 0.16) * mw * smoothstep(0.55, 0.8, n);
            float above = smoothstep(-0.02, 0.12, h);
            float s = stars(d, 70.0, 0.93 - mw * 0.08) * 0.8 + stars(d, 120.0, 0.95 - mw * 0.1) * 0.6 + stars(d, 34.0, 0.975) * 1.6;
            c += vec3(0.95, 0.97, 1.0) * s * above;
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += Math.min(dt, 0.1);
  });
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[320, 48, 24]} />
    </mesh>
  );
}

function Moon() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const glow = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    glow.addColorStop(0, "rgba(220,235,255,0.55)");
    glow.addColorStop(1, "rgba(120,160,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, 256, 256);
    const disc = g.createRadialGradient(118, 118, 4, 128, 128, 44);
    disc.addColorStop(0, "#fffbea");
    disc.addColorStop(1, "#e3e6f0");
    g.fillStyle = disc;
    g.beginPath();
    g.arc(128, 128, 44, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(170,175,200,0.45)";
    for (const [x, y, r] of [[112, 116, 9], [140, 132, 7], [124, 146, 5], [146, 110, 4]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const p = MOON_DIR.clone().multiplyScalar(260);
  return (
    <sprite position={[p.x, p.y * 0.62, p.z]} scale={[46, 46, 1]} renderOrder={-9}>
      <spriteMaterial map={tex} fog={false} depthWrite={false} transparent toneMapped={false} />
    </sprite>
  );
}

/** Night fog and exposure while the district is shown (the hub's own come back on leave). */
function Mood() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const prevFog = scene.fog;
    const prevBg = scene.background;
    const prevExp = gl.toneMappingExposure;
    scene.fog = new THREE.Fog("#10203a", 32, 150);
    scene.background = new THREE.Color("#0b1526");
    gl.toneMappingExposure = 1.3;
    return () => {
      scene.fog = prevFog;
      scene.background = prevBg;
      gl.toneMappingExposure = prevExp;
    };
  }, [scene, gl]);
  return null;
}

function Lights({ plan }: { plan: QualityPlan }) {
  const moon = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = moon.current;
    if (!l) return;
    l.target.position.set(0, 0, -2);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -26;
    c.right = 26;
    c.top = 26;
    c.bottom = -26;
    c.near = 1;
    c.far = 110;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.04;
  }, []);
  const warm: [number, number, number, number][] = [
    [0, 3.2, 0, 14],
    [local(WORKSHOP, 0, 2.2).x, 2.6, local(WORKSHOP, 0, 2.2).z, 10],
    [local(OBSERVATORY, 0, 5.0).x, 3.0, local(OBSERVATORY, 0, 5.0).z, 10],
    [DOCK.x - 2, 2.6, DOCK.z, 9],
    [local(GATE, 0, 1.6).x, 3.0, local(GATE, 0, 1.6).z, 8],
  ];
  return (
    <>
      <hemisphereLight args={["#6d8cd6", "#1b3328", 1.25]} />
      <directionalLight
        ref={moon}
        position={[MOON_DIR.x * 60, MOON_DIR.y * 60, MOON_DIR.z * 60 - 2]}
        intensity={1.55}
        color="#a9c2ff"
        castShadow={plan.shadows}
        shadow-mapSize-width={plan.shadowSize}
        shadow-mapSize-height={plan.shadowSize}
        shadow-radius={4}
      />
      <directionalLight position={[18, 8, 22]} intensity={0.35} color="#79e0d6" />
      <ambientLight intensity={0.12} color="#8090c0" />
      {plan.extras &&
        warm.map(([x, y, z, i], k) => <pointLight key={k} position={[x, y, z]} intensity={i} distance={13} decay={1.6} color="#ffb565" />)}
      {plan.extras && <pointLight position={[GREENHOUSES[0].x, 2.2, GREENHOUSES[0].z]} intensity={10} distance={12} decay={1.6} color="#5ff0d8" />}
    </>
  );
}

// ------------------------------------------------------------------ ground & sea of clouds
function maskTexture(): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i / N - 0.5) * 44;
      const z = (j / N - 0.5) * 44;
      const v = Math.round(paveMask(x, z) * 255);
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

function Ground({ props, game }: { props: SkyharborProps; game: Game }) {
  const [moss, paving] = useTiles([props.textures.moss, props.textures.paving]);
  const mask = useMemo(maskTexture, []);
  const geo = useMemo(() => {
    // a disc with a slightly irregular edge (hidden under the cliff rim)
    const g = new THREE.CircleGeometry(PLATEAU_R, 96, 0, Math.PI * 2);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 1; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const a = Math.atan2(y, x);
      const k = 1 + 0.03 * Math.sin(a * 7) + 0.02 * Math.sin(a * 13 + 1);
      p.setXY(i, x * k, y * k);
    }
    return g;
  }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: moss, roughness: 0.95, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.paveMap = { value: paving };
      sh.uniforms.maskMap = { value: mask };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vShW;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvShW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vShW;\nuniform sampler2D paveMap;\nuniform sampler2D maskMap;")
        .replace(
          "#include <map_fragment>",
          `vec3 shG = texture2D(map, vShW.xz / 6.0).rgb;
           vec3 shG2 = texture2D(map, vShW.xz / 21.0 + vec2(0.31, 0.67)).rgb;
           shG = mix(shG, shG2 * vec3(0.9, 1.05, 1.08), 0.4);
           vec3 shP = texture2D(paveMap, vShW.xz / 4.5).rgb;
           float shM = texture2D(maskMap, vShW.xz / 44.0 + 0.5).r;
           float shN = texture2D(paveMap, vShW.xz / 29.0).r;
           shM = smoothstep(0.3, 0.7, shM + (shN - 0.45) * 0.3);
           float shR = length(vShW.xz);
           vec3 shC = mix(shG, shP * vec3(0.9, 0.82, 0.76), shM);
           shC *= mix(1.0, 0.72, smoothstep(${(PLATEAU_R - 2.4).toFixed(1)}, ${PLATEAU_R.toFixed(1)}, shR));
           diffuseColor.rgb *= shC;`,
        );
    };
    return m;
  }, [moss, paving, mask]);
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      geometry={geo}
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
    />
  );
}

function CloudSea() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: false,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader: `
          varying vec3 vW; uniform float uTime;
          float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.07 + 13.1; a *= 0.5; } return s; }
          void main(){
            vec2 p = vW.xz / 34.0;
            float t = uTime * 0.012;
            float n = fbm(p + vec2(t, t * 0.6));
            float m = fbm(p * 2.3 - vec2(t * 1.7, 0.0) + n);
            float c = smoothstep(0.38, 0.95, n * 0.7 + m * 0.5);
            vec3 deep = vec3(0.03, 0.07, 0.12); vec3 lit = vec3(0.24, 0.34, 0.50); vec3 teal = vec3(0.10, 0.26, 0.30);
            vec3 col = mix(deep, mix(teal, lit, smoothstep(0.55, 0.95, m)), c);
            float d = length(vW.xz);
            float fade = smoothstep(380.0, 120.0, d);
            col = mix(vec3(0.07, 0.16, 0.22), col, fade);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += Math.min(dt, 0.1);
  });
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, -16, 0]} renderOrder={-5}>
      <circleGeometry args={[420, 48]} />
    </mesh>
  );
}

/** Soft mist cards drifting below the plateau rim (depth between the cliffs and the cloud sea). */
function Mist() {
  const tex = useMemo(() => tintedGlow("rgba(150,190,220,0.55)", "rgba(110,150,190,0.22)"), []);
  const items = useMemo(() => {
    const R = rng(77);
    return Array.from({ length: 22 }, () => {
      const a = R() * Math.PI * 2;
      const r = 24 + R() * 40;
      return { x: Math.sin(a) * r, y: -9 + R() * 6, z: Math.cos(a) * r, s: 18 + R() * 22, sp: 0.02 + R() * 0.03, p: R() * 6 };
    });
  }, []);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((s, i) => {
      if (!s) return;
      const it = items[i];
      s.position.x = it.x + Math.sin(t * it.sp + it.p) * 4;
    });
  });
  return (
    <>
      {items.map((it, i) => (
        <sprite key={i} ref={(s) => { refs.current[i] = s; }} position={[it.x, it.y, it.z]} scale={[it.s * 1.8, it.s * 0.5, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.5} fog />
        </sprite>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ cliffs
function Cliffs({ url, plan }: { url: string; plan: QualityPlan }) {
  const gltf = useModel(url);
  const parts = useMemo(() => {
    const p: Record<string, Part[]> = {};
    for (const n of ["rim_a", "rim_b", "spire_a", "spire_b"]) p[n] = meshesOf(gltf.scene, (x) => x === n);
    for (const list of Object.values(p)) for (const x of list) if (/leaves/.test(x.mat.name)) addWind(x.mat, 0.02);
    return p;
  }, [gltf]);
  const layout = useMemo(() => {
    const R = rng(91);
    const rimA: THREE.Matrix4[] = [];
    const rimB: THREE.Matrix4[] = [];
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (R() - 0.5) * 0.08;
      const r = PLATEAU_R - 0.6 + R() * 0.5;
      const s = 0.95 + R() * 0.25;
      (i % 2 ? rimA : rimB).push(mat4(Math.sin(a) * r, -0.08 - R() * 0.1, Math.cos(a) * r, a, s, 1.0 + R() * 0.2));
    }
    // a lower, wider ring of ledges
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3;
      const r = PLATEAU_R + 2.6 + R() * 1.5;
      (i % 2 ? rimB : rimA).push(mat4(Math.sin(a) * r, -3.5 - R() * 3, Math.cos(a) * r, a + 1.0, 1.15 + R() * 0.3, 1.1));
    }
    const spA: THREE.Matrix4[] = [];
    const spB: THREE.Matrix4[] = [];
    const count = plan.extras ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + R() * 0.3;
      const r = 68 + R() * 70;
      // keep the north view framed: more pillars to the sides and back
      const s = 0.8 + R() * 1.3;
      (i % 2 ? spA : spB).push(mat4(Math.sin(a) * r, -10 + R() * 14, Math.cos(a) * r - 10, R() * 6.28, s, s * (0.9 + R() * 0.4)));
    }
    return { rimA, rimB, spA, spB };
  }, [plan.extras]);
  return (
    <>
      <Instanced parts={parts.rim_a} matrices={layout.rimA} />
      <Instanced parts={parts.rim_b} matrices={layout.rimB} />
      <Instanced parts={parts.spire_a} matrices={layout.spA} receive={false} />
      <Instanced parts={parts.spire_b} matrices={layout.spB} receive={false} />
    </>
  );
}

// ------------------------------------------------------------------ set pieces
function Observatory({ url, onPick }: { url: string; onPick: () => void }) {
  const obj = useClone(url);
  const glow = useMemo(() => {
    const list = materialsNamed(obj, (n) => /dome_glow/.test(n));
    // dark sky-glass lit warm from inside: the brass ribs read against it
    for (const m of list) {
      m.color.set("#1d3440");
      m.emissive.set("#ff8a3a");
      m.roughness = 0.12;
      m.metalness = 0.3;
    }
    return list;
  }, [obj]);
  useFrame(({ clock }) => {
    for (const m of glow) m.emissiveIntensity = 0.42 + 0.06 * Math.sin(clock.elapsedTime * 0.7);
  });
  return (
    <Clickable onPick={onPick}>
      <primitive object={obj} position={[OBSERVATORY.x, 0, OBSERVATORY.z]} rotation-y={OBSERVATORY.ry} scale={OBSERVATORY.s || 1} />
    </Clickable>
  );
}

function Workshop({ url }: { url: string }) {
  const obj = useClone(url);
  const gears = useMemo(() => {
    const out: { o: THREE.Object3D; speed: number }[] = [];
    obj.traverse((o) => {
      const m = /^gear_(\d+)/.exec(o.name);
      if (!m || out.some((g) => g.o === o || o.parent === g.o)) return;
      const box = new THREE.Box3().setFromObject(o);
      const r = Math.max(0.1, (box.max.y - box.min.y) / 2);
      out.push({ o, speed: (Number(m[1]) % 2 ? -1 : 1) * 0.45 / r });
    });
    return out;
  }, [obj]);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    for (const g of gears) g.o.rotateZ(g.speed * d);
  });
  return <primitive object={obj} position={[WORKSHOP.x, 0, WORKSHOP.z]} rotation-y={WORKSHOP.ry} />;
}

function Greenhouses({ url, onPick }: { url: string; onPick: () => void }) {
  const gltf = useModel(url);
  const copies = useMemo(
    () =>
      GREENHOUSES.map(() => {
        const o = gltf.scene.clone(true);
        o.traverse((c) => {
          const m = c as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.name === "sh_glass" && !mat.userData.shGlass) {
            mat.userData.shGlass = true;
            mat.transparent = true;
            mat.opacity = 0.2;
            mat.depthWrite = false;
            mat.side = THREE.DoubleSide;
            mat.roughness = 0.05;
            mat.metalness = 0.2;
            mat.color.set("#9fe9ee");
            mat.emissive = new THREE.Color("#2a8f8c");
            mat.emissiveIntensity = 0.25;
          }
          if (mat.name === "sh_glass") {
            m.castShadow = false;
            m.renderOrder = 2;
          }
        });
        return o;
      }),
    [gltf],
  );
  const glow = useMemo(() => materialsNamed(gltf.scene, (n) => /plants_glow|teal_glow/.test(n)), [gltf]);
  useMemo(() => glow.forEach((m) => addWind(m, 0.15)), [glow]);
  useFrame(({ clock }) => {
    for (const m of glow) m.emissiveIntensity = (/plants/.test(m.name) ? 1.9 : 1.2) * (0.85 + 0.15 * Math.sin(clock.elapsedTime * 1.3));
  });
  return (
    <>
      {GREENHOUSES.map((g, i) => {
        const el = <primitive key={i} object={copies[i]} position={[g.x, 0, g.z]} rotation-y={g.ry} scale={g.s || 1} />;
        return i === 0 ? (
          <Clickable key={i} onPick={onPick}>
            {el}
          </Clickable>
        ) : (
          el
        );
      })}
    </>
  );
}

function Airship({ url, onPick }: { url: string; onPick: () => void }) {
  const obj = useClone(url);
  const group = useRef<THREE.Group>(null);
  const props = useMemo(() => {
    const out: THREE.Object3D[] = [];
    obj.traverse((o) => {
      if (/^prop_\d$/.test(o.name)) out.push(o);
    });
    return out;
  }, [obj]);
  useMemo(() => {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /sails/.test(m.name + (m.parent?.name || ""))) addWind(m.material as THREE.Material, 0.06);
    });
  }, [obj]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const g = group.current;
    if (g) {
      g.position.y = AIRSHIP.y + Math.sin(t * 0.7) * 0.22;
      g.rotation.z = Math.sin(t * 0.55) * 0.025;
      g.rotation.x = Math.sin(t * 0.43 + 1) * 0.02;
    }
    for (const p of props) p.rotateX(Math.min(dt, 0.1) * 2.2);
  });
  return (
    <Clickable onPick={onPick}>
      <group position={[AIRSHIP.x, AIRSHIP.y, AIRSHIP.z]} rotation-y={AIRSHIP.ry}>
        <group ref={group}>
          <primitive object={obj} position={[0, -AIRSHIP.y, 0]} />
        </group>
      </group>
    </Clickable>
  );
}

function Gate({ url, game }: { url: string; game: Game }) {
  const obj = useClone(url);
  const portal = useMemo(() => {
    let p: THREE.Object3D | null = null;
    obj.traverse((o) => {
      if (!p && /^portal/.test(o.name)) p = o;
    });
    return p as THREE.Object3D | null;
  }, [obj]);
  const glow = useMemo(() => materialsNamed(obj, (n) => /portal_glow/.test(n)), [obj]);
  useFrame(({ clock }, dt) => {
    if (portal) portal.rotateZ(-Math.min(dt, 0.1) * 0.6);
    for (const m of glow) m.emissiveIntensity = 1.6 + 0.4 * Math.sin(clock.elapsedTime * 1.6);
  });
  return (
    <Clickable
      onPick={() => {
        if (game.mode === "play") game.walkTo = { x: EXIT.x, z: EXIT.z };
      }}
    >
      <primitive object={obj} position={[GATE.x, 0, GATE.z]} rotation-y={GATE.ry} />
    </Clickable>
  );
}

/** Pivot of a node for rotation about its origin (the model's joints). */
function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let f: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!f && o.name === name) f = o;
  });
  return f;
}

/** Bolt, the courier robot: idles, looks at the explorer, waves when they come close. */
function RobotNpc({ url, game, onPick }: { url: string; game: Game; onPick: () => void }) {
  const obj = useClone(url);
  const parts = useMemo(
    () => ({ body: findNode(obj, "robot_body"), head: findNode(obj, "robot_head"), armL: findNode(obj, "arm_l"), armR: findNode(obj, "arm_r") }),
    [obj],
  );
  const rest = useMemo(() => ({ hy: parts.head?.position.y || 0 }), [parts]);
  const root = useRef<THREE.Group>(null);
  const face = useRef(0);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;
    const dx = game.me.x - ROBOT.x;
    const dz = game.me.z - ROBOT.z;
    const near = Math.hypot(dx, dz) < 5;
    const want = near ? Math.atan2(dx, dz) - ROBOT.ry : Math.sin(t * 0.4) * 0.5;
    let d = want - face.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    face.current += d * (1 - Math.exp(-dt * 3));
    if (root.current) root.current.rotation.y = ROBOT.ry + face.current * 0.6;
    if (parts.head) {
      parts.head.rotation.y = face.current * 0.4;
      parts.head.rotation.z = Math.sin(t * 1.3) * 0.06;
      parts.head.position.y = rest.hy + Math.sin(t * 3) * 0.008;
    }
    if (parts.body) parts.body.position.y = Math.sin(t * 3) * 0.01;
    if (parts.armL) parts.armL.rotation.x = Math.sin(t * 1.6) * 0.15;
    if (parts.armR) {
      if (near) {
        parts.armR.rotation.x = -2.4 + Math.sin(t * 7) * 0.3;
        parts.armR.rotation.y = 0.3;
      } else {
        parts.armR.rotation.x = Math.sin(t * 1.6 + 2) * 0.15;
        parts.armR.rotation.y = 0;
      }
    }
  });
  return (
    <Clickable onPick={onPick}>
      <group ref={root} position={[ROBOT.x, 0, ROBOT.z]} rotation-y={ROBOT.ry} scale={1.15}>
        <primitive object={obj} />
      </group>
    </Clickable>
  );
}

/** A second robot rolling crates between the workshop and the pier (showing the courier job). */
function Courier({ url, harbor }: { url: string; harbor: string }) {
  const robot = useModel(url);
  const pack = useModel(harbor);
  const obj = useMemo(() => {
    const o = robot.scene.clone(true);
    const crate = findNode(pack.scene, "crate");
    if (crate) {
      const c = crate.clone(true);
      c.scale.setScalar(0.42);
      c.position.set(0, 1.42, 0);
      o.add(c);
    }
    return o;
  }, [robot, pack]);
  const path = useMemo(() => {
    const a = local(WORKSHOP, 2.8, 2.6);
    const pts = [
      new THREE.Vector3(a.x, 0, a.z),
      new THREE.Vector3(-10.5, 0, -2.4),
      new THREE.Vector3(-15.0, 0, -0.2),
      new THREE.Vector3(-11.5, 0, 1.6),
      new THREE.Vector3(-7.4, 0, -1.6),
    ];
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.4);
  }, []);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const u = (clock.elapsedTime * 0.018) % 1;
    const p = path.getPointAt(u);
    const q = path.getPointAt((u + 0.005) % 1);
    if (g.current) {
      g.current.position.set(p.x, Math.abs(Math.sin(clock.elapsedTime * 8)) * 0.015, p.z);
      g.current.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
    }
  });
  return (
    <group ref={g} scale={0.9}>
      <primitive object={obj} />
    </group>
  );
}

// ------------------------------------------------------------------ railings, lamps, small props
function HarborProps({ url, plan }: { url: string; plan: QualityPlan }) {
  const gltf = useModel(url);
  const parts = useMemo(() => {
    const p: Record<string, Part[]> = {};
    for (const n of ["rail", "lamp", "dock", "crate", "bench"]) p[n] = meshesOf(gltf.scene, (x) => x === n);
    return p;
  }, [gltf]);
  const layout = useMemo(() => {
    const rails: THREE.Matrix4[] = [];
    const N = Math.ceil((Math.PI * 2 * RAIL_R) / 2.0);
    const chord = 2 * RAIL_R * Math.sin(Math.PI / N);
    const glows: number[] = [];
    const lamps: THREE.Matrix4[] = LAMPS.map((l) => mat4(l.x, 0, l.z, l.ry, 1));
    for (const l of LAMPS) {
      const h = local({ x: l.x, z: l.z, ry: l.ry }, 0.55, 0);
      glows.push(h.x, 2.33, h.z);
    }
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      if (railOpen(a0) || railOpen(a1)) continue;
      const x0 = Math.sin(a0) * RAIL_R;
      const z0 = Math.cos(a0) * RAIL_R;
      const x1 = Math.sin(a1) * RAIL_R;
      const z1 = Math.cos(a1) * RAIL_R;
      rails.push(mat4(x0, 0, z0, Math.atan2(-(z1 - z0), x1 - x0), 1, 1, chord / 2));
      if (k % 6 === 0) {
        // a lamp post on the railing every few segments, its arm out over the cliff
        lamps.push(mat4(x0 * 0.985, 0, z0 * 0.985, a0 - Math.PI / 2, 0.85));
        const h = local({ x: x0 * 0.985, z: z0 * 0.985, ry: a0 - Math.PI / 2 }, 0.55 * 0.85, 0);
        glows.push(h.x, 2.33 * 0.85, h.z);
      }
    }
    return {
      rails,
      lamps,
      glows: new Float32Array(glows),
      dock: [mat4(DOCK.x, 0, DOCK.z, DOCK.ry, 1)],
      crates: CRATES.map((c) => mat4(c.x, 0, c.z, c.ry, c.s || 1)),
      benches: BENCHES.map((b) => mat4(b.x, 0, b.z, b.ry, 1)),
    };
  }, []);
  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(layout.glows, 3));
    return g;
  }, [layout]);
  const glowTex = useMemo(() => tintedGlow("rgba(255,236,190,1)", "rgba(255,170,80,0.45)"), []);
  return (
    <>
      <Instanced parts={parts.rail} matrices={layout.rails} shadows={plan.shadowSize > 1024} />
      <Instanced parts={parts.lamp} matrices={layout.lamps} shadows={plan.shadows} />
      <Instanced parts={parts.dock} matrices={layout.dock} shadows={plan.shadows} />
      <Instanced parts={parts.crate} matrices={layout.crates} shadows={plan.shadows} />
      <Instanced parts={parts.bench} matrices={layout.benches} shadows={plan.shadows} />
      <points geometry={glowGeo} frustumCulled={false}>
        <pointsMaterial map={glowTex} size={0.95} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffc680" opacity={0.85} />
      </points>
    </>
  );
}

function Rocks({ url }: { url: string }) {
  const gltf = useModel(url);
  const variants = useMemo(() => ["rock_a", "rock_b"].map((n) => meshesOf(gltf.scene, (x) => x === n)), [gltf]);
  return (
    <>
      {variants.map((p, v) => (
        <Instanced key={v} parts={p} shadows matrices={ROCKS.filter((_, i) => i % 2 === v).map((r) => mat4(r.x, -0.1, r.z, r.ry, r.s || 1))} />
      ))}
    </>
  );
}

function Trees({ url, plan }: { url: string; plan: QualityPlan }) {
  const gltf = useModel(url);
  const parts = useMemo(() => {
    const p = meshesOf(gltf.scene).map((x) => {
      // the Grove's tree, re-tinted for the night (bluer leaves, darker bark)
      const mat = (x.mat as THREE.MeshStandardMaterial).clone();
      if (/leaves|leaf/.test(x.name + mat.name)) {
        mat.color.setRGB(0.62, 0.85, 0.8);
        addWind(mat, 0.03);
      } else mat.color.setRGB(0.7, 0.68, 0.72);
      return { ...x, mat };
    });
    return p;
  }, [gltf]);
  const m = useMemo(() => TREES.map((t) => mat4(t.x, -0.4, t.z, t.ry, (t.s || 1) * 0.72)), []);
  return <Instanced parts={parts} matrices={m} shadows={plan.shadows && plan.shadowSize > 1024} />;
}

// ------------------------------------------------------------------ foliage
function Foliage({ props, plan }: { props: SkyharborProps; plan: QualityPlan }) {
  const fern = useModel(props.models.fern);
  const grass = useModel(props.models.grassTuft);
  const glow = useModel(props.models.glowPlants);
  const solid = useMemo(colliders, []);
  const layout = useMemo(() => {
    const free = (x: number, z: number, pad: number) => {
      const r = Math.hypot(x, z);
      if (r > RAIL_R - 0.4) return false;
      if (paveMask(x, z) > 0.25) return false;
      if (Math.hypot(x - EXIT.x, z - EXIT.z) < 2.2) return false;
      for (const c of solid) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
      return true;
    };
    const R = rng(1234);
    const g: THREE.Matrix4[] = [];
    const f: THREE.Matrix4[] = [];
    const pl: THREE.Matrix4[][] = [[], [], [], [], []];
    const nGrass = Math.round(plan.grass * 0.45);
    let guard = 0;
    while (g.length < nGrass && guard++ < nGrass * 8) {
      const a = R() * Math.PI * 2;
      const r = Math.sqrt(R()) * RAIL_R;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (!free(x, z, 0.1)) continue;
      const s = 0.6 + R() * 0.7;
      g.push(mat4(x, 0, z, R() * 6.28, s * 1.1, s));
    }
    // anchors: building feet, the rail ring, rocks
    const anchors: { x: number; z: number; r: number }[] = [
      { x: OBSERVATORY.x, z: OBSERVATORY.z, r: 5.6 },
      ...GREENHOUSES.map((h) => ({ x: h.x, z: h.z, r: 3.6 * (h.s || 1) })),
      ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: 1.6 * (r.s || 1) })),
      { ...local(WORKSHOP, 0, -0.5), r: 3.2 },
      { ...local(GATE, 0, 0), r: 2.4 },
      ...Array.from({ length: 16 }, (_, i) => ({ x: Math.sin(i * 0.39) * (RAIL_R - 0.9), z: Math.cos(i * 0.39) * (RAIL_R - 0.9), r: 0.9 })),
    ];
    const nFern = Math.round(plan.ferns * 0.7);
    guard = 0;
    while (f.length < nFern && guard++ < nFern * 12) {
      const an = anchors[Math.floor(R() * anchors.length)];
      const a = R() * Math.PI * 2;
      const x = an.x + Math.sin(a) * an.r * (0.85 + R() * 0.5);
      const z = an.z + Math.cos(a) * an.r * (0.85 + R() * 0.5);
      if (!free(x, z, 0.25)) continue;
      f.push(mat4(x, 0, z, R() * 6.28, 0.7 + R() * 0.7));
    }
    const nGlow = Math.round(plan.flowers * 0.42);
    let n = 0;
    guard = 0;
    while (n < nGlow && guard++ < nGlow * 12) {
      const an = anchors[Math.floor(R() * anchors.length)];
      const a = R() * Math.PI * 2;
      const kind = Math.floor(R() * 5);
      const k = 2 + Math.floor(R() * 3);
      const cx = an.x + Math.sin(a) * an.r * (0.8 + R() * 0.6);
      const cz = an.z + Math.cos(a) * an.r * (0.8 + R() * 0.6);
      for (let i = 0; i < k && n < nGlow; i++) {
        const x = cx + (R() - 0.5) * 1.4;
        const z = cz + (R() - 0.5) * 1.4;
        if (!free(x, z, 0.2)) continue;
        pl[kind].push(mat4(x, 0, z, R() * 6.28, 0.7 + R() * 0.6));
        n++;
      }
    }
    return { g, f, pl };
  }, [plan.grass, plan.ferns, plan.flowers, solid]);
  const parts = useMemo(() => {
    const fp = meshesOf(fern.scene).map((p) => ({ ...p, mat: (p.mat as THREE.Material).clone() }));
    const gp = meshesOf(grass.scene).map((p) => ({ ...p, mat: (p.mat as THREE.Material).clone() }));
    // painted cards are lit from one side only: a little self-light keeps their backs from going black at night
    const nightCard = (m: THREE.MeshStandardMaterial, c: [number, number, number], e: number) => {
      m.color.setRGB(c[0], c[1], c[2]);
      m.emissive = new THREE.Color(0.32 * e, 0.5 * e, 0.46 * e);
      m.emissiveMap = m.map;
      m.emissiveIntensity = 1;
      addWind(m, 1);
    };
    fp.forEach((p) => nightCard(p.mat as THREE.MeshStandardMaterial, [0.72, 0.95, 0.95], 0.42));
    gp.forEach((p) => nightCard(p.mat as THREE.MeshStandardMaterial, [0.55, 0.78, 0.8], 0.38));
    const pl = ["plant_fern", "plant_bell", "plant_blades", "plant_caps", "plant_crystal"].map((nm) => meshesOf(glow.scene, (x) => x === nm));
    pl.flat().forEach((p) => addWind(p.mat, 0.8));
    return { fp, gp, pl };
  }, [fern, grass, glow]);
  const glowMats = useMemo(() => {
    const list = materialsNamed(glow.scene, (n) => /glow/.test(n));
    // the mushroom caps and crystals: coloured light, not white-hot
    for (const m of list) {
      if (/teal_glow/.test(m.name)) {
        m.color.set("#0f8f88");
        m.emissive.set("#19c9b8");
        m.emissiveIntensity = 0.75;
      } else if (/violet_glow/.test(m.name)) m.emissiveIntensity = 0.8;
    }
    for (const m of materialsNamed(glow.scene, (n) => /sh_stem/.test(n))) {
      m.color.set("#7d9a96");
      m.emissiveIntensity = 0.15;
    }
    return list;
  }, [glow]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    glowMats.forEach((m, i) => {
      if (m.userData.shBase == null) m.userData.shBase = m.emissiveIntensity;
      m.emissiveIntensity = m.userData.shBase * (0.8 + 0.2 * Math.sin(t * 1.1 + i * 1.7));
    });
  });
  return (
    <>
      <Instanced parts={parts.gp} matrices={layout.g} />
      <Instanced parts={parts.fp} matrices={layout.f} shadows={plan.shadowSize > 1024} />
      {parts.pl.map((p, i) => (
        <Instanced key={i} parts={p} matrices={layout.pl[i]} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ atmosphere
function Fireflies({ count }: { count: number }) {
  const make = (seed: number, n: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const R = rng(seed);
    const s = Array.from({ length: n }, () => {
      const a = R() * Math.PI * 2;
      const r = Math.sqrt(R()) * (PLATEAU_R + 6);
      return { x: Math.sin(a) * r, z: Math.cos(a) * r, y: 0.4 + R() * 4.5, sp: 0.15 + R() * 0.4, p: R() * 6.28 };
    });
    return { g, s };
  };
  const teal = useMemo(() => make(11, Math.round(count * 0.6)), [count]);
  const amber = useMemo(() => make(29, Math.round(count * 0.4)), [count]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const set of [teal, amber]) {
      const a = set.g.getAttribute("position") as THREE.BufferAttribute;
      set.s.forEach((s, i) => a.setXYZ(i, s.x + Math.sin(t * s.sp + s.p) * 1.6, s.y + Math.sin(t * s.sp * 1.9 + s.p) * 0.6, s.z + Math.cos(t * s.sp * 0.8 + s.p) * 1.6));
      a.needsUpdate = true;
    }
  });
  const tTex = useMemo(() => tintedGlow("rgba(220,255,250,1)", "rgba(80,240,220,0.5)"), []);
  const aTex = useMemo(() => tintedGlow("rgba(255,245,210,1)", "rgba(255,190,90,0.5)"), []);
  return (
    <>
      <points geometry={teal.g} frustumCulled={false}>
        <pointsMaterial map={tTex} size={0.34} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#9ffff0" />
      </points>
      <points geometry={amber.g} frustumCulled={false}>
        <pointsMaterial map={aTex} size={0.3} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffd890" />
      </points>
    </>
  );
}

// ------------------------------------------------------------------ logic: targets, exit, sound
function Logic({ props, game, onExit }: { props: SkyharborProps; game: Game; onExit: () => void }) {
  const mexty = useMexty();
  const settings = useSettings();
  useEffect(() => {
    const T = TARGETS;
    const k = (s: string) => s as unknown as TargetKind; // district kinds are strings "<id>:<what>"
    game.targets = [
      { key: "sky-robot", kind: k(KIND_ROBOT), ref: "robot", x: T.robot.x, z: T.robot.z, reach: T.robot.reach },
      { key: "sky-planets", kind: k(KIND_PLANETS), ref: "planets", x: T.planets.x, z: T.planets.z, reach: T.planets.reach },
      { key: "sky-greenhouse", kind: k(KIND_INFO), ref: "greenhouse", x: T.greenhouse.x, z: T.greenhouse.z, reach: T.greenhouse.reach },
      { key: "sky-airship", kind: k(KIND_INFO), ref: "airship", x: T.airship.x, z: T.airship.z, reach: T.airship.reach },
    ];
    return () => {
      game.targets = [];
      game.focus = null;
    };
  }, [game]);
  // sound: the district's ambience replaces the grove's while here
  useEffect(() => {
    skySound.configure(props.sounds);
    hubSound.stopAmbience();
    skySound.unlock();
    skySound.startAmbience();
    const tap = () => skySound.unlock();
    window.addEventListener("pointerdown", tap);
    return () => {
      window.removeEventListener("pointerdown", tap);
      skySound.stopAmbience();
      hubSound.startAmbience();
    };
  }, [props.sounds]);
  useEffect(() => skySound.setMuted(!settings.sound || !!mexty.muted), [settings.sound, mexty.muted]);
  useEffect(() => skySound.setPaused(!!mexty.paused), [mexty.paused]);
  // the exit: stepping into the gate's portal (armed once the explorer has been away from it)
  const armed = useRef(false);
  const gone = useRef(false);
  useFrame(() => {
    if (game.mode !== "play" || gone.current) return;
    const d = Math.hypot(game.me.x - EXIT.x, game.me.z - EXIT.z);
    if (d > EXIT.r + 1.2) armed.current = true;
    else if (armed.current && d < EXIT.r) {
      gone.current = true;
      game.walkTo = null;
      onExit();
    }
  });
  return null;
}

// ------------------------------------------------------------------ the district
export function Scene({ props, game, plan, onOpen, onExit }: {
  props: SkyharborProps;
  game: Game;
  plan: QualityPlan;
  onOpen: (o: SkyharborOpen) => void;
  onExit: () => void;
}) {
  const m = props.models;
  return (
    <>
      <Mood />
      <NightSky />
      <Moon />
      <Lights plan={plan} />
      <Ground props={props} game={game} />
      <CloudSea />
      {plan.extras && <Mist />}
      <Cliffs url={m.cliff} plan={plan} />
      <Observatory url={m.observatory} onPick={() => onOpen({ kind: KIND_PLANETS })} />
      <Workshop url={m.workshop} />
      <RobotNpc url={m.robot} game={game} onPick={() => onOpen({ kind: KIND_ROBOT })} />
      <Courier url={m.robot} harbor={m.harbor} />
      <Greenhouses url={m.greenhouse} onPick={() => onOpen({ kind: KIND_INFO, ref: "greenhouse" })} />
      <Airship url={m.airship} onPick={() => onOpen({ kind: KIND_INFO, ref: "airship" })} />
      <Gate url={m.gate} game={game} />
      <HarborProps url={m.harbor} plan={plan} />
      <Rocks url={m.cliff} />
      <Trees url={m.forestTree} plan={plan} />
      <Foliage props={props} plan={plan} />
      <Fireflies count={plan.extras ? 140 : 60} />
      <Logic props={props} game={game} onExit={onExit} />
    </>
  );
}
