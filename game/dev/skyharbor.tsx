// Local harness for the Skyharbor district alone (no hub): the scene, a walking explorer with the same
// 3/4 camera as the hub, the action button and the Activity overlay. Assets from dev/public/skyharbor
// (copy assets/blender/skyharbor/build/* there) and the Grove's shared ones from dev/public/a.
//   npx vite --config dev/vite.config.ts  →  http://localhost:5180/skyharbor.html
// URL options: ?q=low|medium|high · ?lang=fr · ?open=robot|planets|info:greenhouse|info:airship
//              ?at=x,z,ry (start point) · ?remote=1 (use the props' published URLs, needs a MEXTY login)
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { pickLanguage } from "@mexty/sdk";
import "../src/styles.css";
import "../src/game.css";
import type { LocalizedText, T } from "../src/block";
import { createGame, Game } from "../src/game/state";
import { qualityPlan, Quality, TOUCH } from "../src/settings";
import { useModel, wind } from "../src/scene/assets";
import { sound } from "../src/audio";
import * as Sky from "../src/zones/skyharbor";
import type { SkyharborOpen, SkyharborProps } from "../src/zones/skyharbor";

const q = new URLSearchParams(window.location.search);
const LANG = q.get("lang") === "fr" ? "fr" : "en";
const CAM = (q.get("cam") || "").split(",").map(Number).filter((n) => !isNaN(n));
const A = "/skyharbor/";

function localProps(): SkyharborProps {
  const only = (q.get("levels") || "").split(",").filter(Boolean);
  const p: SkyharborProps = only.length
    ? { ...Sky.defaultProps, levels: Sky.defaultProps.levels.filter((l) => only.indexOf(l.id) >= 0), roundMain: only.length, roundSimple: only.length }
    : Sky.defaultProps;
  if (q.get("remote")) return p;
  return {
    ...p,
    models: {
      observatory: A + "sh_observatory.glb",
      airship: A + "sh_airship.glb",
      greenhouse: A + "sh_greenhouse.glb",
      workshop: A + "sh_workshop.glb",
      robot: A + "sh_robot.glb",
      harbor: A + "sh_harbor_props.glb",
      cliff: A + "sh_cliff.glb",
      glowPlants: A + "sh_glowplants.glb",
      gate: A + "sh_gate.glb",
      fern: "/a/fern.glb",
      grassTuft: "/a/grass_tuft.glb",
      forestTree: "/a/forest_tree.glb",
    },
    textures: { paving: A + "sh_paving.jpg", moss: A + "sh_moss.jpg" },
    sounds: { ambience: A + "sh_ambience.mp3", beep: A + "sh_beep.mp3", bump: A + "sh_bump.mp3", whirr: A + "sh_whirr.mp3" },
  };
}

const t: T = (x, vars) => {
  let s = x == null ? "" : typeof x === "string" ? x : pickLanguage(x as LocalizedText, LANG, "en");
  if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
};

// ------------------------------------------------------------------ the explorer (harness copy of the hub's Me)
function Explorer({ game }: { game: Game }) {
  const gltf = useModel("/a/kid_avatar.glb");
  const { obj, mixer, actions } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
        const preset: Record<string, string> = { skin: "#f1c7a5", hair: "#5a3825", shirt: "#3aa6a0", pants: "#3f5f8f", shoes: "#7a4a2a", bag: "#e0923c" };
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        if (preset[mat.name]) mat.color.set(preset[mat.name]);
        m.material = mat;
      }
    });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c);
    actions.idle?.play();
    return { obj, mixer, actions };
  }, [gltf]);
  const g = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const solid = useMemo(Sky.colliders, []);
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
    const len = Math.min(1, Math.hypot(ix, iz));
    let nx = me.x + ix * 4.6 * dt;
    let nz = me.z + iz * 4.6 * dt;
    for (let pass = 0; pass < 2; pass++)
      for (const c of solid) {
        const dx = nx - c.x;
        const dz = nz - c.z;
        const d = Math.hypot(dx, dz);
        if (d < c.r + 0.32 && d > 1e-4) {
          nx = c.x + (dx / d) * (c.r + 0.32);
          nz = c.z + (dz / d) * (c.r + 0.32);
        }
      }
    const r = Math.hypot(nx, nz);
    if (r > Sky.WORLD_R) {
      nx *= Sky.WORLD_R / r;
      nz *= Sky.WORLD_R / r;
    }
    me.moving = len > 0.08 && Math.hypot(nx - me.x, nz - me.z) > 0.2 * 4.6 * dt * len;
    if (len > 0.08) me.ry = Math.atan2(ix, iz);
    me.x = nx;
    me.z = nz;
    if (game.walkTo && !me.moving) game.walkTo = null;
    let best = null;
    let bd = 1e9;
    for (const tg of game.targets) {
      const d = Math.hypot(tg.x - me.x, tg.z - me.z);
      if (d < tg.reach && d < bd) {
        bd = d;
        best = tg;
      }
    }
    game.focus = best;
    if (g.current) {
      g.current.position.set(me.x, Sky.groundY(me.x, me.z), me.z);
      g.current.rotation.y = me.ry;
    }
    const want = me.moving ? "walk" : "idle";
    if (want !== cur.current && actions[want]) {
      actions[want].reset().play();
      actions[cur.current]?.crossFadeTo(actions[want], 0.2, false);
      cur.current = want;
    }
    mixer.update(dt);
    const k = size.height > size.width ? 1.35 : 1;
    const wantPos = new THREE.Vector3(me.x, 5.4 * k, me.z + 8.2 * k);
    const lookAt = new THREE.Vector3(me.x, 1.5, me.z - 3.2);
    if (CAM.length === 6) {
      camera.position.set(CAM[0], CAM[1], CAM[2]);
      camera.lookAt(CAM[3], CAM[4], CAM[5]);
      wind.value += dt;
      return;
    }
    if (first.current) {
      camera.position.copy(wantPos);
      look.current.copy(lookAt);
      first.current = false;
    }
    look.current.lerp(lookAt, 1 - Math.exp(-dt * 6));
    camera.position.lerp(wantPos, 1 - Math.exp(-dt * 4));
    camera.lookAt(look.current);
    wind.value += dt;
  });
  return (
    <group ref={g}>
      <primitive object={obj} />
    </group>
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
  const props = useMemo(localProps, []);
  const game = useMemo(() => {
    const g = createGame();
    const at = (q.get("at") || "").split(",").map(Number);
    g.me.x = at.length >= 2 && !isNaN(at[0]) ? at[0] : Sky.SPAWN.x;
    g.me.z = at.length >= 2 && !isNaN(at[1]) ? at[1] : Sky.SPAWN.z;
    g.me.ry = at.length >= 3 ? at[2] : Math.PI;
    g.mode = "play";
    (window as unknown as { __owGame: Game }).__owGame = g;
    return g;
  }, []);
  const quality = (q.get("q") as Quality) || "auto";
  const plan = qualityPlan(quality);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<SkyharborOpen | null>(() => {
    const o = q.get("open");
    if (!o) return null;
    if (o === "robot") return { kind: Sky.KIND_ROBOT };
    if (o === "planets") return { kind: Sky.KIND_PLANETS };
    if (o.startsWith("info:")) return { kind: Sky.KIND_INFO, ref: o.slice(5) };
    return null;
  });
  const [exited, setExited] = useState(false);
  const [focus, setFocus] = useState<string>("");
  const onOpen = useCallback((o: SkyharborOpen) => setOpen(o), []);
  useEffect(() => {
    sound.configure({ ambience: "", chime: "/a/chime.mp3", pop: "/a/pop.mp3", success: "/a/success.mp3" });
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    const keys = new Set<string>();
    const upd = () => {
      game.input.x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      game.input.z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      if (open) return;
      keys.add(e.code);
      upd();
      if ((e.code === "KeyE" || e.code === "Enter") && game.focus) act();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      upd();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const id = window.setInterval(() => setFocus(game.focus ? game.focus.key : ""), 200);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, open]);
  const act = () => {
    const f = game.focus;
    if (!f) return;
    setOpen({ kind: String(f.kind), ref: String(f.ref) });
  };
  const post = plan.bloom || plan.vignette;
  return (
    <div className="ow-root">
      <Canvas
        className="ow-canvas"
        shadows={plan.shadows ? "soft" : false}
        dpr={plan.dpr}
        camera={{ position: [0, 6, 16], fov: 50, near: 0.3, far: 700 }}
        gl={{ antialias: !TOUCH && !post, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          scene.fog = new THREE.Fog("#c8c48e", 30, 82);
        }}
      >
        <Suspense fallback={null}>
          <Sky.Scene props={props} game={game} plan={plan} onOpen={onOpen} onExit={() => setExited(true)} />
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
          <div className="ow-loading-title">{t(props.ui.name)}</div>
        </div>
      )}
      {loaded && <div id="sh-ready" style={{ display: "none" }} />}
      <div className="ow-hud">
        <div className="ow-chips">
          <div className="ow-chip">🔭 {t(props.ui.name)}</div>
        </div>
        {focus && !open && (
          <div className="ow-actions">
            <button className="ow-btn ow-act" onClick={act}>
              {focus === "sky-robot" ? "🤖 " + t(props.ui.talkRobot) : focus === "sky-planets" ? "🪐 " + t(props.ui.usePlanets) : "👀 " + t(props.ui.look)}
            </button>
          </div>
        )}
      </div>
      {open && <Sky.Activity props={props} open={open} t={t} onClose={() => setOpen(null)} paused={false} />}
      {exited && (
        <div className="ow-modal" onPointerDown={() => setExited(false)}>
          <div className="ow-card ow-info">
            <h2 className="ow-card-title">🌳 {t(props.ui.backToGrove)}</h2>
            <p className="ow-card-small">(harness: onExit() was called)</p>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
