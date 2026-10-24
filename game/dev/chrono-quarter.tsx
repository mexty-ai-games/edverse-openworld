// Local harness for the Chrono Quarter district: renders only this district (no hub), with a
// stand-in explorer (the Idea Grove's kid avatar), keys / stick / tap-to-walk, the hub's post effects,
// and the Time Detective overlay. Assets come from dev/public (cq/ = this district, a/ = Idea Grove).
//   npx vite --config dev/vite.config.ts  ->  http://localhost:5180/chrono-quarter.html
//   ?q=low|medium|high   picture quality      ?young=1   little-detective mode
//   ?view=x,z,ry         start the explorer at a point (screenshots)
//   ?cam=x,y,z,lx,ly,lz  fixed camera
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
import "../src/game.css";
import grove from "./props.local.json";
import { Scene, Activity, defaultProps, SPAWN, WORLD_R, colliders, groundY, type ChronoQuarterProps } from "../src/zones/chrono-quarter";
import { getCase, newRound, setCase } from "../src/zones/chrono-quarter/store";

// ------------------------------------------------------------------ local asset URLs
const LOCAL: Record<string, string> = {
  temple: "cq/cq_roman_temple.glb",
  columns: "cq/cq_roman_columns.glb",
  fountain: "cq/cq_fountain.glb",
  pavilion: "cq/cq_edo_pavilion.glb",
  bridge: "cq/cq_arched_bridge.glb",
  stoneLantern: "cq/cq_stone_lantern.glb",
  pyramid: "cq/cq_maya_pyramid.glb",
  stela: "cq/cq_maya_stela.glb",
  cherry: "cq/cq_cherry_tree.glb",
  streetLamp: "cq/cq_street_lamp.glb",
  gate: "cq/cq_quarter_gate.glb",
  plinths: "cq/cq_era_plinths.glb",
  dial: "cq/cq_time_dial.glb",
  jungle: "cq/cq_jungle_plants.glb",
  pondLife: "cq/cq_pond_life.glb",
  artifacts: "cq/cq_artifacts.glb",
  boulders: "a/boulders.glb",
  forestTree: "a/forest_tree.glb",
  fern: "a/fern.glb",
  flowers: "a/flowers.glb",
  grassTuft: "a/grass_tuft.glb",
};
const LOCAL_TEX: Record<string, string> = {
  grass: "a/ground_grass.jpg",
  dirt: "a/ground_dirt.jpg",
  cobbles: "cq/cq_cobbles.jpg",
  paving: "cq/cq_forum_paving.jpg",
  skyline: "cq/cq_skyline.png",
};
const props: ChronoQuarterProps = {
  ...defaultProps,
  models: Object.fromEntries(Object.keys(defaultProps.models).map((k) => [k, "/" + LOCAL[k]])) as unknown as ChronoQuarterProps["models"],
  textures: Object.fromEntries(Object.keys(defaultProps.textures).map((k) => [k, "/" + LOCAL_TEX[k]])) as unknown as ChronoQuarterProps["textures"],
  sounds: { ambience: "/cq/cq_ambience.mp3" },
};

const qs = new URLSearchParams(window.location.search);
const quality = (qs.get("q") as Quality) || "auto";
/** ?cam=x,y,z,lookX,lookY,lookZ: a fixed camera (overview screenshots). */
const CAM = qs.get("cam") ? qs.get("cam")!.split(",").map(Number) : null;

// ------------------------------------------------------------------ stand-in explorer
interface Preset {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  bag: string;
}

function Avatar({ url, preset, read }: { url: string; preset: Preset; read: () => { moving: boolean; emote: string; emoteAt: number } }) {
  const gltf = useModel(url);
  const { obj, mixer, actions } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    obj.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      const c = (preset as unknown as Record<string, string>)[mat.name];
      if (c) mat.color.set(c);
      m.material = mat;
    });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    if (actions.cheer) {
      actions.cheer.setLoop(THREE.LoopOnce, 1);
      actions.cheer.clampWhenFinished = true;
    }
    if (actions.idle) actions.idle.play();
    return { obj, mixer, actions };
  }, [gltf, preset]);
  const cur = useRef("idle");
  const started = useRef(0);
  useFrame((_, dt) => {
    const s = read();
    let want = s.moving ? "walk" : "idle";
    if (!s.moving && s.emote === "cheer" && performance.now() - s.emoteAt < 1250) want = "cheer";
    if (want !== cur.current || (want === "cheer" && started.current < s.emoteAt)) {
      const next = actions[want];
      const prev = actions[cur.current];
      if (next) {
        next.reset();
        next.play();
        if (prev && prev !== next) prev.crossFadeTo(next, 0.22, false);
      }
      cur.current = want;
      started.current = performance.now();
    }
    mixer.update(Math.min(dt, 0.1));
  });
  return <primitive object={obj} />;
}

function angleLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function Explorer({ game }: { game: Game }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const solid = useMemo(colliders, []);
  const look = useRef(new THREE.Vector3(game.me.x, 1, game.me.z - 3));
  const first = useRef(true);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
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
    me.y = groundY(me.x, me.z);
    let best: Target | null = null;
    let bd = 1e9;
    for (const t of game.targets) {
      const d = Math.hypot(t.x - me.x, t.z - me.z);
      if (d < t.reach && d < bd) {
        bd = d;
        best = t;
      }
    }
    game.focus = best;
    const g = group.current;
    if (g) {
      g.position.set(me.x, me.y, me.z);
      g.rotation.y = me.ry;
    }
    const portrait = size.height > size.width;
    const k = portrait ? 1.35 : 1;
    const want = new THREE.Vector3(me.x, me.y + 5.4 * k, me.z + 8.2 * k);
    const at = new THREE.Vector3(me.x, me.y + 1.5, me.z - 3.2);
    if (CAM) {
      camera.position.set(CAM[0], CAM[1], CAM[2]);
      camera.lookAt(CAM[3], CAM[4], CAM[5]);
      return;
    }
    if (first.current) {
      first.current = false;
      camera.position.copy(want);
      look.current.copy(at);
    }
    look.current.lerp(at, 1 - Math.exp(-dt * 6));
    camera.position.lerp(want, 1 - Math.exp(-dt * 4));
    camera.lookAt(look.current);
  });
  return (
    <group ref={group}>
      <Avatar url={"/" + String(grove.models.avatar).replace(/^\//, "")} preset={grove.avatars[1] as Preset} read={() => game.me} />
    </group>
  );
}

function Clock() {
  useFrame((_, dt) => {
    wind.value += Math.min(dt, 0.1);
  });
  return null;
}

// ------------------------------------------------------------------ minimal HUD (keys, stick, action)
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

function DevHud({ game, blocked }: { game: Game; blocked: boolean }) {
  const [focus, setFocus] = useState<Target | null>(null);
  useEffect(() => {
    const iv = window.setInterval(() => setFocus(game.focus), 150);
    return () => window.clearInterval(iv);
  }, [game]);
  const act = () => game.focus && window.dispatchEvent(new CustomEvent("ow-open", { detail: game.focus }));
  useEffect(() => {
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
      if (blocked) return;
      if (KEYS[e.code]) {
        held.add(e.code);
        upd();
        e.preventDefault();
      } else if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") {
        act();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) upd();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      game.input.x = game.input.z = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, blocked]);
  const label = focus ? (String(focus.kind).endsWith("artifact") ? "✨" : String(focus.kind).endsWith("dial") ? "⏳" : "👀") : "";
  return (
    <div className={"ow-hud" + (blocked ? " blocked" : "")}>
      <div className="ow-chips">
        <div className="ow-chip">🏛️ Chrono Quarter</div>
      </div>
      <div className="ow-actions">
        {focus && (
          <button className="ow-btn ow-act" onClick={act}>
            <span className="ow-act-icon">{label}</span> E
          </button>
        )}
      </div>
    </div>
  );
}

function Loaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onLoaded, 300);
    return () => window.clearTimeout(id);
  }, [onLoaded]);
  return null;
}

function App() {
  const game = useMemo(() => {
    const g = createGame();
    g.mode = "play";
    const v = qs.get("view");
    if (v) {
      const [x, z, ry] = v.split(",").map(Number);
      g.me.x = x;
      g.me.z = z;
      g.me.ry = ry || 0;
    } else {
      g.me.x = SPAWN.x;
      g.me.z = SPAWN.z;
      g.me.ry = SPAWN.ry;
    }
    return g;
  }, []);
  const plan = qualityPlan(quality);
  const [blocked, setBlocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exited, setExited] = useState(0);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__cq = { game, getCase, setCase, newRound, props, loaded };
  }, [game, loaded]);
  useEffect(() => {
    sound.configure({ ...(grove.sounds as { ambience: string; chime: string; pop: string; success: string }), ambience: props.sounds.ambience });
  }, []);
  const post = plan.bloom || plan.vignette;
  return (
    <div className="ow-root" onPointerDown={() => sound.unlock()}>
      <Canvas
        className="ow-canvas"
        shadows={plan.shadows ? "soft" : false}
        dpr={plan.dpr}
        camera={{ position: [0, 8, 26], fov: 50, near: 0.3, far: 400 }}
        gl={{ antialias: !TOUCH && !post, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Clock />
        <Suspense fallback={null}>
          <Scene props={props} game={game} plan={plan} onExit={() => setExited((n) => n + 1)} />
          <Explorer game={game} />
          <Loaded onLoaded={() => setLoaded(true)} />
        </Suspense>
        {post && (
          <EffectComposer multisampling={plan.msaa} enableNormalPass={false}>
            <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
            <Vignette offset={0.28} darkness={plan.vignette ? 0.5 : 0} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
      {!loaded && (
        <div className="ow-loading">
          <div className="ow-lantern-spin" />
          <div className="ow-loading-title">Chrono Quarter</div>
        </div>
      )}
      {loaded && <DevHud game={game} blocked={blocked} />}
      {loaded && <Activity props={props} game={game} young={qs.get("young") === "1" ? true : undefined} onBlockingChange={setBlocked} />}
      {exited > 0 && (
        <div className="cq-toast" data-testid="exited">
          🌳 → Idea Grove ({exited})
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
