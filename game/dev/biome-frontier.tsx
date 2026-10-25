// Local harness for the Biome Frontier district alone (ticket 7f686b): the district Scene + Activity,
// with a stand-in explorer (the hub's kid avatar, movement and 3/4 follow camera re-created here with the
// district's layout), keyboard / tap-to-walk and an action button. The hub integrates the real thing.
//
// Assets: the props' library URLs are mapped to local files (/bf/<file> = the district's build folder,
// /a/<file> = the grove's dev/public/a), because the library refuses cross-origin requests from localhost.
// URL params: ?q=low|medium|high  ?pos=x,z[,ry]  ?open=dig|station|sign:coast  ?easy=1  ?lang=fr
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createGame, Game, Target } from "../src/game/state";
import { qualityPlan, Quality, TOUCH } from "../src/settings";
import { useModel, wind } from "../src/scene/assets";
import { sound } from "../src/audio";
import type { LocalizedText } from "../src/block";
import { Activity, Scene, defaultProps, SPAWN, colliders, groundY, WORLD_R, useSurvey } from "../src/zones/biome-frontier";
import type { BiomeFrontierProps } from "../src/zones/biome-frontier";
import { ASSETS, ASSET_FILES } from "../src/zones/biome-frontier/assets.gen";
import "../src/game.css";

const qs = new URLSearchParams(window.location.search);
const LANG = qs.get("lang") === "fr" ? "fr" : "en";

function localize<T>(p: T): T {
  const map = new Map<string, string>();
  (Object.keys(ASSETS) as (keyof typeof ASSETS)[]).forEach((k) => map.set(ASSETS[k], "/bf/" + ASSET_FILES[k]));
  map.set(defaultProps.models.fern, "/a/fern.glb");
  map.set(defaultProps.models.grassTuft, "/a/grass_tuft.glb");
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return map.get(v) || v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x);
      return o;
    }
    return v;
  };
  return walk(p) as T;
}

const t = (x: LocalizedText | string | undefined, vars?: Record<string, string | number>) => {
  let s = x == null ? "" : typeof x === "string" ? x : x[LANG] || x.en || "";
  if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
};

function angleLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** The stand-in explorer: the hub's avatar, moved and followed exactly like the hub does (district layout). */
function Explorer({ game }: { game: Game }) {
  const gltf = useModel("/a/kid_avatar.glb");
  const { obj, mixer, actions } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        const tint: Record<string, string> = { skin: "#8d5a3b", hair: "#1f1410", shirt: "#3fa7a0", pants: "#c9a66b", shoes: "#2f3a56", bag: "#e76f51" };
        if (tint[mat.name]) mat.color.set(tint[mat.name]);
        m.material = mat;
      }
    });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c);
    actions.idle?.play();
    return { obj, mixer, actions };
  }, [gltf]);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const solid = useMemo(colliders, []);
  const look = useRef(new THREE.Vector3(game.me.x, 1, game.me.z - 3));
  const cur = useRef("idle");
  const first = useRef(true);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const me = game.me;
    let ix = game.input.x;
    let iz = game.input.z;
    if (ix || iz) game.walkTo = null;
    else if (game.walkTo) {
      const dx = game.walkTo.x - me.x;
      const dz = game.walkTo.z - me.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) game.walkTo = null;
      else {
        ix = dx / d;
        iz = dz / d;
      }
    }
    let len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
      len = 1;
    }
    const speed = 4.6 * len;
    let nx = me.x + ix * speed * dt;
    let nz = me.z + iz * speed * dt;
    for (let pass = 0; pass < 2; pass++)
      for (const c of solid) {
        const dx = nx - c.x;
        const dz = nz - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + 0.32;
        if (d < min && d > 1e-4) {
          nx = c.x + (dx / d) * min;
          nz = c.z + (dz / d) * min;
        }
      }
    const r = Math.hypot(nx, nz);
    if (r > WORLD_R) {
      nx *= WORLD_R / r;
      nz *= WORLD_R / r;
    }
    const moved = Math.hypot(nx - me.x, nz - me.z);
    me.moving = len > 0.08 && moved > 0.2 * speed * dt;
    if (len > 0.08) me.ry = angleLerp(me.ry, Math.atan2(ix, iz), 1 - Math.exp(-dt * 12));
    me.x = nx;
    me.z = nz;
    if (game.walkTo && !me.moving) game.walkTo = null;
    let best: Target | null = null;
    let bd = 1e9;
    for (const tg of game.targets) {
      const d = Math.hypot(tg.x - me.x, tg.z - me.z);
      if (d < tg.reach && d < bd) {
        bd = d;
        best = tg;
      }
    }
    game.focus = best;
    me.y = groundY(me.x, me.z);
    if (group.current) {
      group.current.position.set(me.x, me.y, me.z);
      group.current.rotation.y = me.ry;
    }
    const want = me.moving ? "walk" : "idle";
    if (want !== cur.current && actions[want]) {
      actions[want].reset().play();
      actions[cur.current]?.crossFadeTo(actions[want], 0.22, false);
      cur.current = want;
    }
    mixer.update(dt);
    const portrait = size.height > size.width;
    const k = portrait ? 1.35 : 1;
    const wantPos = new THREE.Vector3(me.x, me.y + 5.4 * k, me.z + 8.2 * k);
    look.current.lerp(new THREE.Vector3(me.x, me.y + 1.5, me.z - 3.2), first.current ? 1 : 1 - Math.exp(-dt * 6));
    if (first.current) camera.position.copy(wantPos);
    else camera.position.lerp(wantPos, 1 - Math.exp(-dt * 4));
    first.current = false;
    camera.lookAt(look.current);
  });
  return (
    <group ref={group}>
      <primitive object={obj} />
    </group>
  );
}

function Clock() {
  useFrame((_, dt) => {
    wind.value += Math.min(dt, 0.1);
  });
  return null;
}

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

function App() {
  const game = useMemo(() => {
    const g = createGame();
    g.mode = "play";
    const pos = (qs.get("pos") || "").split(",").map(Number);
    g.me.x = pos.length >= 2 && !isNaN(pos[0]) ? pos[0] : SPAWN.x;
    g.me.z = pos.length >= 2 && !isNaN(pos[1]) ? pos[1] : SPAWN.z;
    g.me.ry = pos.length >= 3 && !isNaN(pos[2]) ? pos[2] : SPAWN.ry;
    return g;
  }, []);
  const props = useMemo(() => localize<BiomeFrontierProps>(defaultProps), []);
  const plan = qualityPlan((qs.get("q") as Quality) || "auto");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<Target | null>(null);
  const [exited, setExited] = useState(0);
  const [frozen, setFrozen] = useState(false);
  // test hooks: the game state, the survey store, and a freeze (stop rendering) for headless screenshots
  (window as unknown as Record<string, unknown>).__bf = { game, survey: useSurvey, freeze: (on = true) => setFrozen(on) };
  useEffect(() => {
    sound.configure({ ambience: "/bf/bf_ambience.mp3", chime: "/a/chime.mp3", pop: "/a/pop.mp3", success: "/a/success.mp3" });
    if (qs.get("easy") === "1") useSurvey.getState().setEasy(true);
    const o = qs.get("open");
    if (o) {
      const [k, v] = o.split(":");
      window.setTimeout(() => {
        const s = useSurvey.getState();
        if (k === "sign") s.open({ kind: "sign", biome: v || "coast" });
        else if (k === "dig") s.open({ kind: "dig" });
        else s.open({ kind: "station" });
      }, 300);
    }
    const iv = window.setInterval(() => setFocus(game.focus), 150);
    const held = new Set<string>();
    const upd = () => {
      let x = 0;
      let z = 0;
      held.forEach((c) => {
        x += KEYS[c][0];
        z += KEYS[c][1];
      });
      game.input.x = x;
      game.input.z = z;
    };
    const down = (e: KeyboardEvent) => {
      if (useSurvey.getState().view) return;
      if (KEYS[e.code]) {
        held.add(e.code);
        upd();
      } else if (e.code === "KeyE" || e.code === "Enter") game.focus && window.dispatchEvent(new CustomEvent("ow-open", { detail: game.focus }));
    };
    const up = (e: KeyboardEvent) => held.delete(e.code) && upd();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [game]);
  const post = plan.bloom || plan.vignette;
  return (
    <div className="ow-root" onPointerDown={() => sound.unlock()}>
      <Canvas
        className="ow-canvas"
        shadows={plan.shadows ? "soft" : false}
        dpr={plan.dpr}
        frameloop={frozen ? "never" : "always"}
        camera={{ position: [0, 8, 28], fov: 50, near: 0.3, far: 400 }}
        gl={{ antialias: !TOUCH && !post, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Clock />
        <Suspense fallback={null}>
          <Scene props={props} game={game} plan={plan} onOpen={() => undefined} onExit={() => setExited((n) => n + 1)} />
          <Explorer game={game} />
        </Suspense>
        {post && (
          <EffectComposer multisampling={plan.msaa} enableNormalPass={false}>
            <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
            <Vignette offset={0.28} darkness={plan.vignette ? 0.5 : 0} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
      <div className={"ow-hud" + (busy ? " blocked" : "")}>
        <div className="ow-chips">
          <div className="ow-chip">🧭 {t(props.ui.title)}</div>
          {exited > 0 && <div className="ow-chip">🏮 {t(props.ui.backToGrove)} ({exited})</div>}
        </div>
        <div className="ow-actions">
          {focus && (
            <button className="ow-btn ow-act" onClick={() => window.dispatchEvent(new CustomEvent("ow-open", { detail: game.focus }))}>
              <span className="ow-act-icon">👀</span>
              {t(props.ui.look)}
            </button>
          )}
        </div>
      </div>
      <Activity props={props} t={t} onBusy={setBusy} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
